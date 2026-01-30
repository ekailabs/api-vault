// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Subcall} from "@oasisprotocol/sapphire-contracts/contracts/Subcall.sol";

contract EkaiControlPlane is Ownable2Step {
    // ============ Structs ============

    struct RoflKey {
        bytes pubkey;
        uint64 version;
        bool active;
    }

    struct Secret {
        bytes ciphertext;
        uint64 version;
        bool exists;
    }

    // ============ State Variables ============

    // Admin
    RoflKey public roflKey;
    bytes21 public roflAppId;  // ROFL app identifier for Sapphire verification
    address public gateway;    // Fallback for non-ROFL calls (optional)
    mapping(bytes32 => bool) public validProviders;
    bool public paused;

    // Secrets: owner => providerId => Secret
    mapping(address => mapping(bytes32 => Secret)) private _secrets;

    // Delegates (shared across ALL owner's keys)
    mapping(address => mapping(address => bool)) public delegateAllowed;
    mapping(address => uint32) public delegateCount;

    // Models (per owner+provider)
    mapping(address => mapping(bytes32 => mapping(bytes32 => bool))) public modelAllowed;
    mapping(address => mapping(bytes32 => uint32)) public modelCount;

    // ============ Events ============

    event GatewayUpdated(address indexed oldGateway, address indexed newGateway);
    event RoflAppIdUpdated(bytes21 indexed oldAppId, bytes21 indexed newAppId);
    event RoflKeyUpdated(bytes pubkey, uint64 version, bool active);
    event ProviderAdded(bytes32 indexed providerId);
    event ProviderRemoved(bytes32 indexed providerId);
    event SecretSet(address indexed owner, bytes32 indexed providerId, uint64 version);
    event SecretRevoked(address indexed owner, bytes32 indexed providerId, uint64 version);
    event DelegateAdded(address indexed owner, address indexed delegate);
    event DelegateRemoved(address indexed owner, address indexed delegate);
    event ModelAllowed(address indexed owner, bytes32 indexed providerId, bytes32 indexed modelId);
    event ModelDisallowed(address indexed owner, bytes32 indexed providerId, bytes32 indexed modelId);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event ReceiptLogged(
        bytes32 indexed requestHash,
        address indexed owner,
        address indexed delegate,
        bytes32 providerId,
        bytes32 modelId,
        uint32 promptTokens,
        uint32 completionTokens,
        uint64 roflKeyVersion,
        uint64 secretVersion,
        uint64 timestamp
    );

    // ============ Errors ============

    error InvalidGateway();
    error InvalidRoflAppId();
    error InvalidRoflKey();
    error RoflKeyNotActive();
    error InvalidProvider();
    error InvalidDelegate();
    error InvalidModel();
    error ProviderExists();
    error ProviderNotFound();
    error SecretNotFound();
    error DelegateExists();
    error DelegateNotFound();
    error ModelExists();
    error ModelNotFound();
    error EmptyCiphertext();
    error ContractPaused();
    error NotAuthorized();

    // ============ Modifiers ============

    modifier onlyRoflOrGateway() {
        // First try ROFL verification (preferred on Sapphire)
        if (roflAppId != bytes21(0)) {
            // This will revert if caller is not the authorized ROFL app
            Subcall.roflEnsureAuthorizedOrigin(roflAppId);
        } else if (gateway != address(0)) {
            // Fallback to address-based check
            if (msg.sender != gateway) revert NotAuthorized();
        } else {
            revert NotAuthorized();
        }
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ============ Constructor ============

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ============ Admin Functions (onlyOwner) ============

    function setGateway(address newGateway) external onlyOwner {
        if (newGateway == address(0)) revert InvalidGateway();
        address oldGateway = gateway;
        gateway = newGateway;
        emit GatewayUpdated(oldGateway, newGateway);
    }

    function clearGateway() external onlyOwner {
        address oldGateway = gateway;
        gateway = address(0);
        emit GatewayUpdated(oldGateway, address(0));
    }

    function setRoflAppId(bytes21 newAppId) external onlyOwner {
        if (newAppId == bytes21(0)) revert InvalidRoflAppId();
        bytes21 oldAppId = roflAppId;
        roflAppId = newAppId;
        emit RoflAppIdUpdated(oldAppId, newAppId);
    }

    function clearRoflAppId() external onlyOwner {
        bytes21 oldAppId = roflAppId;
        roflAppId = bytes21(0);
        emit RoflAppIdUpdated(oldAppId, bytes21(0));
    }

    function setRoflKey(bytes calldata pubkey, bool active) external onlyOwner {
        if (pubkey.length == 0) revert InvalidRoflKey();
        roflKey.version++;
        roflKey.pubkey = pubkey;
        roflKey.active = active;
        emit RoflKeyUpdated(pubkey, roflKey.version, active);
    }

    function setRoflKeyActive(bool active) external onlyOwner {
        roflKey.active = active;
        emit RoflKeyUpdated(roflKey.pubkey, roflKey.version, active);
    }

    function addProvider(bytes32 providerId) external onlyOwner {
        if (providerId == bytes32(0)) revert InvalidProvider();
        if (validProviders[providerId]) revert ProviderExists();
        validProviders[providerId] = true;
        emit ProviderAdded(providerId);
    }

    function removeProvider(bytes32 providerId) external onlyOwner {
        if (!validProviders[providerId]) revert ProviderNotFound();
        validProviders[providerId] = false;
        emit ProviderRemoved(providerId);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ============ User - Secrets ============

    function setSecret(bytes32 providerId, bytes calldata ciphertext) external whenNotPaused {
        if (!validProviders[providerId]) revert InvalidProvider();
        if (ciphertext.length == 0) revert EmptyCiphertext();
        if (roflKey.pubkey.length == 0 || !roflKey.active) revert RoflKeyNotActive();

        Secret storage s = _secrets[msg.sender][providerId];

        s.version++;
        s.ciphertext = ciphertext;
        s.exists = true;

        emit SecretSet(msg.sender, providerId, s.version);
    }

    function revokeSecret(bytes32 providerId) external {
        Secret storage s = _secrets[msg.sender][providerId];
        if (!s.exists) revert SecretNotFound();

        s.version++;
        s.exists = false;
        delete s.ciphertext;

        emit SecretRevoked(msg.sender, providerId, s.version);
    }

    // ============ User - Delegates ============

    function addDelegate(address delegate) external whenNotPaused {
        if (delegate == address(0)) revert InvalidDelegate();
        if (delegateAllowed[msg.sender][delegate]) revert DelegateExists();

        delegateAllowed[msg.sender][delegate] = true;
        delegateCount[msg.sender]++;

        emit DelegateAdded(msg.sender, delegate);
    }

    function removeDelegate(address delegate) external {
        if (!delegateAllowed[msg.sender][delegate]) revert DelegateNotFound();

        delegateAllowed[msg.sender][delegate] = false;
        delegateCount[msg.sender]--;

        emit DelegateRemoved(msg.sender, delegate);
    }

    // ============ User - Models ============

    function addAllowedModel(bytes32 providerId, bytes32 modelId) external whenNotPaused {
        if (!validProviders[providerId]) revert InvalidProvider();
        if (modelId == bytes32(0)) revert InvalidModel();
        if (modelAllowed[msg.sender][providerId][modelId]) revert ModelExists();

        modelAllowed[msg.sender][providerId][modelId] = true;
        modelCount[msg.sender][providerId]++;

        emit ModelAllowed(msg.sender, providerId, modelId);
    }

    function removeAllowedModel(bytes32 providerId, bytes32 modelId) external {
        if (!validProviders[providerId]) revert InvalidProvider();
        if (!modelAllowed[msg.sender][providerId][modelId]) revert ModelNotFound();

        modelAllowed[msg.sender][providerId][modelId] = false;
        modelCount[msg.sender][providerId]--;

        emit ModelDisallowed(msg.sender, providerId, modelId);
    }

    // ============ Views ============

    function getSecretCiphertext(
        address owner,
        bytes32 providerId
    ) external view returns (bytes memory ciphertext, uint64 secretVersion, bool exists, uint64 roflKeyVersion) {
        // No access control needed: ciphertext is encrypted to ROFL key,
        // only decryptable inside the enclave. Gateway enforces permissions
        // via isDelegatePermitted() and isModelPermitted() before use.
        Secret storage s = _secrets[owner][providerId];
        return (s.ciphertext, s.version, s.exists, roflKey.version);
    }

    function isDelegatePermitted(address owner, address delegate) external view returns (bool) {
        // Owner always has self-access
        if (delegate == owner) {
            return true;
        }
        // If no delegates configured, deny all (only owner)
        if (delegateCount[owner] == 0) {
            return false;
        }
        // Check allowlist
        return delegateAllowed[owner][delegate];
    }

    function isModelPermitted(address owner, bytes32 providerId, bytes32 modelId) external view returns (bool) {
        // If no models configured, allow all
        if (modelCount[owner][providerId] == 0) {
            return true;
        }
        // Check allowlist
        return modelAllowed[owner][providerId][modelId];
    }

    // ============ Gateway Functions ============

    function logReceipt(
        bytes32 requestHash,
        address owner,
        address delegate,
        bytes32 providerId,
        bytes32 modelId,
        uint32 promptTokens,
        uint32 completionTokens
    ) external onlyRoflOrGateway {
        // Read versions from storage to ensure accuracy
        Secret storage s = _secrets[owner][providerId];

        emit ReceiptLogged(
            requestHash,
            owner,
            delegate,
            providerId,
            modelId,
            promptTokens,
            completionTokens,
            roflKey.version,
            s.version,
            uint64(block.timestamp)
        );
    }

    // ============ Helper Views ============

    function isValidProvider(bytes32 providerId) external view returns (bool) {
        return validProviders[providerId];
    }

    function getRoflKey() external view returns (bytes memory pubkey, uint64 version, bool active) {
        return (roflKey.pubkey, roflKey.version, roflKey.active);
    }

    function getRoflAppId() external view returns (bytes21) {
        return roflAppId;
    }

    function isPaused() external view returns (bool) {
        return paused;
    }
}
