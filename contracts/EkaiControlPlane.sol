// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

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
    address public gateway;
    mapping(bytes32 => bool) public validProviders;

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
    event RoflKeyUpdated(bytes pubkey, uint64 version, bool active);
    event ProviderAdded(bytes32 indexed providerId);
    event ProviderRemoved(bytes32 indexed providerId);
    event SecretSet(address indexed owner, bytes32 indexed providerId, uint64 version);
    event SecretRevoked(address indexed owner, bytes32 indexed providerId, uint64 version);
    event DelegateAdded(address indexed owner, address indexed delegate);
    event DelegateRemoved(address indexed owner, address indexed delegate);
    event ModelAllowed(address indexed owner, bytes32 indexed providerId, bytes32 indexed modelId);
    event ModelDisallowed(address indexed owner, bytes32 indexed providerId, bytes32 indexed modelId);
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

    // ============ Modifiers ============

    modifier onlyGateway() {
        require(msg.sender == gateway, "Only gateway");
        _;
    }

    // ============ Constructor ============

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ============ Admin Functions (onlyOwner) ============

    function setGateway(address newGateway) external onlyOwner {
        address oldGateway = gateway;
        gateway = newGateway;
        emit GatewayUpdated(oldGateway, newGateway);
    }

    function setRoflKey(bytes calldata pubkey, uint64 version, bool active) external onlyOwner {
        roflKey = RoflKey({pubkey: pubkey, version: version, active: active});
        emit RoflKeyUpdated(pubkey, version, active);
    }

    function addProvider(bytes32 providerId) external onlyOwner {
        require(!validProviders[providerId], "Provider already exists");
        validProviders[providerId] = true;
        emit ProviderAdded(providerId);
    }

    function removeProvider(bytes32 providerId) external onlyOwner {
        require(validProviders[providerId], "Provider not found");
        validProviders[providerId] = false;
        emit ProviderRemoved(providerId);
    }

    // ============ Owner - Secrets ============

    function setSecret(bytes32 providerId, bytes calldata ciphertext) external {
        require(validProviders[providerId], "Invalid provider");
        require(ciphertext.length > 0, "Empty ciphertext");

        Secret storage s = _secrets[msg.sender][providerId];

        s.version++;
        s.ciphertext = ciphertext;
        s.exists = true;

        emit SecretSet(msg.sender, providerId, s.version);
    }

    function revokeSecret(bytes32 providerId) external {
        Secret storage s = _secrets[msg.sender][providerId];
        require(s.exists, "Secret not found");

        s.version++;
        s.exists = false;
        delete s.ciphertext;

        emit SecretRevoked(msg.sender, providerId, s.version);
    }

    // ============ Owner - Delegates ============

    function addDelegate(address delegate) external {
        require(delegate != address(0), "Invalid delegate");
        require(!delegateAllowed[msg.sender][delegate], "Delegate already added");

        delegateAllowed[msg.sender][delegate] = true;
        delegateCount[msg.sender]++;

        emit DelegateAdded(msg.sender, delegate);
    }

    function removeDelegate(address delegate) external {
        require(delegateAllowed[msg.sender][delegate], "Delegate not found");

        delegateAllowed[msg.sender][delegate] = false;
        delegateCount[msg.sender]--;

        emit DelegateRemoved(msg.sender, delegate);
    }

    // ============ Owner - Models ============

    function addAllowedModel(bytes32 providerId, bytes32 modelId) external {
        require(validProviders[providerId], "Invalid provider");
        require(!modelAllowed[msg.sender][providerId][modelId], "Model already allowed");

        modelAllowed[msg.sender][providerId][modelId] = true;
        modelCount[msg.sender][providerId]++;

        emit ModelAllowed(msg.sender, providerId, modelId);
    }

    function removeAllowedModel(bytes32 providerId, bytes32 modelId) external {
        require(modelAllowed[msg.sender][providerId][modelId], "Model not allowed");

        modelAllowed[msg.sender][providerId][modelId] = false;
        modelCount[msg.sender][providerId]--;

        emit ModelDisallowed(msg.sender, providerId, modelId);
    }

    // ============ Views ============

    function getSecretCiphertext(
        address owner,
        bytes32 providerId
    ) external view returns (bytes memory ciphertext, uint64 secretVersion, bool exists, uint64 roflKeyVersion) {
        // Access control: only owner or gateway can read
        require(
            msg.sender == owner || msg.sender == gateway,
            "Not authorized"
        );

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
        uint32 completionTokens,
        uint64 usedRoflKeyVersion,
        uint64 usedSecretVersion
    ) external onlyGateway {
        emit ReceiptLogged(
            requestHash,
            owner,
            delegate,
            providerId,
            modelId,
            promptTokens,
            completionTokens,
            usedRoflKeyVersion,
            usedSecretVersion,
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
}
