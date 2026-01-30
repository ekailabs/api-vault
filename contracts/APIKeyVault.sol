// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SiweAuth} from "@oasisprotocol/sapphire-contracts/contracts/auth/SiweAuth.sol";

contract APIKeyVault is SiweAuth {
    // Standard Provider IDs (only these are allowed)
    bytes32 public constant ANTHROPIC_API_KEY = keccak256(abi.encodePacked("ANTHROPIC_API_KEY"));
    bytes32 public constant OPENAI_API_KEY = keccak256(abi.encodePacked("OPENAI_API_KEY"));
    bytes32 public constant XAI_API_KEY = keccak256(abi.encodePacked("XAI_API_KEY"));
    bytes32 public constant OPENROUTER_API_KEY = keccak256(abi.encodePacked("OPENROUTER_API_KEY"));
    bytes32 public constant ZAI_API_KEY = keccak256(abi.encodePacked("ZAI_API_KEY"));
    bytes32 public constant GOOGLE_API_KEY = keccak256(abi.encodePacked("GOOGLE_API_KEY"));

    // Valid provider IDs registry
    mapping(bytes32 => bool) public validProviders;

    struct Secret {
        bytes ciphertext;
        uint64 version;
        bool exists;
    }

    // owner => providerId => Secret
    mapping(address => mapping(bytes32 => Secret)) private _secrets;

    // owner => providerId => version => allowedAddress => bool
    mapping(address => mapping(bytes32 => mapping(uint64 => mapping(address => bool)))) public allowlist;

    // Events (no plaintext)
    event SecretRegistered(address indexed owner, bytes32 indexed providerId, uint64 version);
    event SecretRevoked(address indexed owner, bytes32 indexed providerId);
    event SecretAccessed(address indexed owner, bytes32 indexed providerId, address indexed accessor);
    event AddressAddedToAllowlist(address indexed owner, bytes32 indexed providerId, address indexed user, uint64 version);
    event AddressRemovedFromAllowlist(address indexed owner, bytes32 indexed providerId, address indexed user, uint64 version);

    constructor(string memory domain) SiweAuth(domain) {
        validProviders[ANTHROPIC_API_KEY] = true;
        validProviders[OPENAI_API_KEY] = true;
        validProviders[XAI_API_KEY] = true;
        validProviders[OPENROUTER_API_KEY] = true;
        validProviders[ZAI_API_KEY] = true;
        validProviders[GOOGLE_API_KEY] = true;
    }

    function registerSecret(bytes32 providerId, bytes calldata ciphertext) external {
        require(validProviders[providerId], "Invalid provider ID");
        require(ciphertext.length > 0, "Empty ciphertext");

        Secret storage s = _secrets[msg.sender][providerId];

        if (s.exists) {
            s.version++;
        }

        s.ciphertext = ciphertext;
        s.exists = true;

        emit SecretRegistered(msg.sender, providerId, s.version);
    }

    function addToAllowlist(bytes32 providerId, address user) external {
        require(user != address(0), "Invalid address");

        Secret storage s = _secrets[msg.sender][providerId];
        require(s.exists, "Secret not found");

        allowlist[msg.sender][providerId][s.version][user] = true;

        emit AddressAddedToAllowlist(msg.sender, providerId, user, s.version);
    }

    function removeFromAllowlist(bytes32 providerId, address user) external {
        Secret storage s = _secrets[msg.sender][providerId];
        require(s.exists, "Secret not found");

        allowlist[msg.sender][providerId][s.version][user] = false;

        emit AddressRemovedFromAllowlist(msg.sender, providerId, user, s.version);
    }

    /// @notice Get secret - works with either direct tx (msg.sender) or SIWE token
    /// @param owner The address that owns the secret
    /// @param providerId The provider ID (e.g., OPENAI_API_KEY hash)
    /// @param authToken SIWE auth token (empty bytes for direct tx)
    function getSecret(
        address owner,
        bytes32 providerId,
        bytes calldata authToken
    ) external view returns (bytes memory) {
        // Determine caller: use authToken if provided, else msg.sender
        address caller = authToken.length > 0 ? authMsgSender(authToken) : msg.sender;
        require(caller != address(0), "Invalid caller");

        Secret storage s = _secrets[owner][providerId];
        require(s.exists, "Secret not found");
        require(allowlist[owner][providerId][s.version][caller], "Not in allowlist");

        return s.ciphertext;
    }

    /// @notice Get secret info - works with either direct tx or SIWE token
    function getSecretInfo(
        address owner,
        bytes32 providerId,
        bytes calldata authToken
    ) external view returns (uint64 version, bool exists, bool isAllowed) {
        address caller = authToken.length > 0 ? authMsgSender(authToken) : msg.sender;

        Secret storage s = _secrets[owner][providerId];
        version = s.version;
        exists = s.exists;
        isAllowed = caller != address(0) && allowlist[owner][providerId][s.version][caller];
    }

    function revokeSecret(bytes32 providerId) external {
        Secret storage s = _secrets[msg.sender][providerId];
        require(s.exists, "Secret not found");

        s.version++;
        s.exists = false;
        delete s.ciphertext;

        emit SecretRevoked(msg.sender, providerId);
    }

    function isValidProvider(bytes32 providerId) external view returns (bool) {
        return validProviders[providerId];
    }
}
