// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract APIKeyVault {
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

    // For CLI: store last retrieved secret per caller (cleared on read)
    mapping(address => bytes) private _pendingSecret;

    // Events (no plaintext)
    event SecretRegistered(address indexed owner, bytes32 indexed providerId, uint64 version);
    event SecretRevoked(address indexed owner, bytes32 indexed providerId);
    event SecretAccessed(address indexed owner, bytes32 indexed providerId, address indexed accessor);
    event AddressAddedToAllowlist(address indexed owner, bytes32 indexed providerId, address indexed user, uint64 version);
    event AddressRemovedFromAllowlist(address indexed owner, bytes32 indexed providerId, address indexed user, uint64 version);

    constructor() {
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

        // If secret exists, increment version to invalidate old allowlist
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

    function getSecret(address owner, bytes32 providerId) external view returns (bytes memory) {
        Secret storage s = _secrets[owner][providerId];
        require(s.exists, "Secret not found");
        // Note: On Sapphire, unauthenticated view calls have msg.sender = address(0)
        // address(0) won't be in any allowlist, so this check implicitly rejects unsigned calls
        require(allowlist[owner][providerId][s.version][msg.sender], "Not in allowlist");

        return s.ciphertext;
    }

    // Transaction-based secret retrieval - stores for later claim
    function getSecretTx(address owner, bytes32 providerId) external returns (bool) {
        Secret storage s = _secrets[owner][providerId];
        require(s.exists, "Secret not found");
        require(allowlist[owner][providerId][s.version][msg.sender], "Not in allowlist");

        // Store for caller to claim via transaction
        _pendingSecret[msg.sender] = s.ciphertext;
        emit SecretAccessed(owner, providerId, msg.sender);
        return true;
    }

    // Claim the pending secret with signature verification (works in view calls)
    function claimSecret(bytes32 hash, uint8 v, bytes32 r, bytes32 s) external view returns (bytes memory) {
        // Recover signer from signature
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "Invalid signature");

        bytes memory secret = _pendingSecret[signer];
        require(secret.length > 0, "No pending secret");
        return secret;
    }

    // Clear pending secret (call after claiming to clean up)
    function clearPending() external {
        delete _pendingSecret[msg.sender];
    }

    function logAccess(address owner, bytes32 providerId) external {
        Secret storage s = _secrets[owner][providerId];
        require(s.exists, "Secret not found");
        require(allowlist[owner][providerId][s.version][msg.sender], "Not in allowlist");

        emit SecretAccessed(owner, providerId, msg.sender);
    }

    function getSecretInfo(address owner, bytes32 providerId) external view returns (
        uint64 version,
        bool exists,
        bool isAllowed
    ) {
        Secret storage s = _secrets[owner][providerId];
        version = s.version;
        exists = s.exists;
        isAllowed = allowlist[owner][providerId][s.version][msg.sender];
    }

    function revokeSecret(bytes32 providerId) external {
        Secret storage s = _secrets[msg.sender][providerId];
        require(s.exists, "Secret not found");

        // Increment version to invalidate allowlist
        s.version++;
        s.exists = false;
        delete s.ciphertext;

        emit SecretRevoked(msg.sender, providerId);
    }

    function isValidProvider(bytes32 providerId) external view returns (bool) {
        return validProviders[providerId];
    }
}
