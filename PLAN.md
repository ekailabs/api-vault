# API Key Vault - Implementation Plan

A secure, policy-driven Private Control Plane on Oasis Sapphire for managing API keys with access control.

## Overview

Owners can store encrypted API keys (OpenAI, Anthropic, Google, etc.) and grant access to specific addresses. Sapphire's confidential computing ensures secrets remain private.

## Contract: `APIKeyVault.sol`

### Storage

```solidity
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
    bytes ciphertext;      // Encrypted API key
    uint64 version;        // Version for allowlist invalidation
    bool exists;           // To check if secret is registered
}

// owner => providerId => Secret
mapping(address => mapping(bytes32 => Secret)) private _secrets;

// owner => providerId => version => allowedAddress => bool
mapping(address => mapping(bytes32 => mapping(uint64 => mapping(address => bool)))) public allowlist;
```

### Events (No Plaintext)

```solidity
event SecretRegistered(address indexed owner, bytes32 indexed providerId, uint64 version);
event SecretRevoked(address indexed owner, bytes32 indexed providerId);
event SecretAccessed(address indexed owner, bytes32 indexed providerId, address indexed accessor);
event AddressAddedToAllowlist(address indexed owner, bytes32 indexed providerId, address indexed user, uint64 version);
event AddressRemovedFromAllowlist(address indexed owner, bytes32 indexed providerId, address indexed user, uint64 version);
```

### Constructor

```solidity
constructor() {
    validProviders[ANTHROPIC_API_KEY] = true;
    validProviders[OPENAI_API_KEY] = true;
    validProviders[XAI_API_KEY] = true;
    validProviders[OPENROUTER_API_KEY] = true;
    validProviders[ZAI_API_KEY] = true;
    validProviders[GOOGLE_API_KEY] = true;
}
```

### Functions

#### 1. `registerSecret(bytes32 providerId, bytes calldata ciphertext)`
- **Access**: Anyone (caller becomes owner of their own secret)
- **Validation**:
  - `require(validProviders[providerId], "Invalid provider ID")`
  - `require(ciphertext.length > 0, "Empty ciphertext")`
- **Action**:
  - If secret exists, increment version (invalidates old allowlist)
  - Store secret for `msg.sender` under `providerId`
- **Event**: `SecretRegistered(msg.sender, providerId, version)`

#### 2. `addToAllowlist(bytes32 providerId, address user)`
- **Access**: Only owner of that secret
- **Validation**:
  - `require(user != address(0), "Invalid address")`
- **Logic**:
  ```solidity
  Secret storage s = _secrets[msg.sender][providerId];
  require(s.exists, "Secret not found");
  allowlist[msg.sender][providerId][s.version][user] = true;
  ```
- **Event**: `AddressAddedToAllowlist(msg.sender, providerId, user, s.version)`

#### 3. `removeFromAllowlist(bytes32 providerId, address user)`
- **Access**: Only owner of that secret
- **Logic**:
  ```solidity
  Secret storage s = _secrets[msg.sender][providerId];
  require(s.exists, "Secret not found");
  allowlist[msg.sender][providerId][s.version][user] = false;
  ```
- **Event**: `AddressRemovedFromAllowlist(msg.sender, providerId, user, s.version)`

#### 4. `getSecret(address owner, bytes32 providerId) view returns (bytes memory ciphertext)`
- **Type**: Authenticated VIEW (requires `sapphire.wrap` for signed query)
- **Access**: Anyone in the owner's allowlist for this providerId
- **Parameters**:
  - `owner`: Address of the secret owner (whose secret to fetch)
  - `providerId`: Which API key to retrieve
- **Logic**:
  ```solidity
  require(msg.sender != address(0), "Unauthenticated call");
  Secret storage s = _secrets[owner][providerId];
  require(s.exists, "Secret not found");
  require(allowlist[owner][providerId][s.version][msg.sender], "Not in allowlist");
  return s.ciphertext;
  ```
- **Note**: On Sapphire, unauthenticated view calls have `msg.sender = address(0)`. Use signed queries via `sapphire.wrap` to authenticate.
- **Example**: If Owner A adds Wallet B to allowlist, Wallet B calls `getSecret(ownerA, OPENAI_API_KEY)` to retrieve the secret.

#### 5. `logAccess(address owner, bytes32 providerId)`
- **Type**: Transaction (for audit trail)
- **Logic**:
  ```solidity
  Secret storage s = _secrets[owner][providerId];
  require(s.exists, "Secret not found");
  require(allowlist[owner][providerId][s.version][msg.sender], "Not in allowlist");
  emit SecretAccessed(owner, providerId, msg.sender);
  ```
- **Note**: Optional - call after getSecret if audit log needed

#### 6. `getSecretInfo(address owner, bytes32 providerId) view returns (...)`
- **Access**: Public view
- **Returns**: `(uint64 version, bool exists, bool isAllowed)`
- **Note**: Does NOT return ciphertext

#### 7. `revokeSecret(bytes32 providerId)`
- **Access**: Only owner
- **Validation**: `require(_secrets[msg.sender][providerId].exists, "Secret not found")`
- **Action**:
  - Increment version (invalidates allowlist)
  - Set exists = false, clear ciphertext
- **Event**: `SecretRevoked(msg.sender, providerId)`

#### 8. `isValidProvider(bytes32 providerId) view returns (bool)`
- **Access**: Public view
- **Returns**: Whether the provider ID is in the valid list

## Versioning Mechanism

```
┌─────────────────────────────────────────────────────────────────────┐
│                  ALLOWLIST INVALIDATION VIA VERSIONING              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Register Secret (v1)                                               │
│  └── allowlist[owner][providerId][1][walletB] = true               │
│                                                                     │
│  Revoke Secret                                                      │
│  └── version incremented to 2, exists = false                       │
│                                                                     │
│  Register Secret (v2)                                               │
│  └── allowlist[owner][providerId][2][walletB] = false (default!)   │
│      ^ WalletB must be re-added explicitly                          │
│                                                                     │
│  Old allowlist entries (v1) are now unreachable                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## File Changes

### New Files
- `contracts/APIKeyVault.sol` - Main contract

### Modified Files
- `tasks/index.ts` - Add tasks for testing:
  - `deploy-vault` - Deploy APIKeyVault
  - `register-secret` - Register a test secret
  - `add-allowlist` - Add address to allowlist
  - `remove-allowlist` - Remove address from allowlist
  - `get-secret` - Fetch secret (authenticated view via sapphire.wrap)
  - `log-access` - Log access event (transaction for audit trail)
  - `revoke-secret` - Revoke a secret
  - `full-vault-demo` - End-to-end test

## Mandatory Testing Plan

### Local Testing (sapphire-localnet)

1. **Setup**: Run `docker run -it -p8544-8548:8544-8548 ghcr.io/oasisprotocol/sapphire-localnet`

2. **Deploy**: `npx hardhat deploy-vault --network sapphire-localnet`

### Test Scenarios

#### Test 1: Invalid Provider ID
- Try to register secret with `keccak256("INVALID_KEY")` → should fail

#### Test 2: Address(0) Trap (View Call Authentication)
- Call `getSecret` as unauthenticated view (without signed query)
- On Sapphire, unauthenticated view calls have `msg.sender = address(0)`
- Allowlist check fails since `address(0)` is not in any allowlist
- Call `getSecret` as authenticated view (with SIWE token or MetaMask signed query)
- `msg.sender` = actual signer address → succeeds
- **Note**: Normal transactions always have valid `msg.sender`; this trap is for view calls only
- **Hardhat Limitation**: Signed queries require SIWE setup; use production dApp with MetaMask for full testing

#### Test 3: Sovereignty (Owner Isolation)
- Owner A registers ANTHROPIC_API_KEY ✓
- Owner B tries to add address to Owner A's allowlist ✗ (should fail)
- Owner B tries to revoke Owner A's secret ✗ (should fail)

#### Test 4: Owner Self-Access
- Owner registers OPENAI_API_KEY
- Owner adds themselves to allowlist
- Owner calls getSecret → returns ciphertext ✓

#### Test 5: Allowlist Access
- Owner registers GOOGLE_API_KEY
- Owner adds Wallet B to allowlist
- Wallet B calls getSecret → returns ciphertext ✓
- Wallet C (not in allowlist) calls getSecret → fails ✗

#### Test 6: Versioning Test (Critical)
- Owner registers ANTHROPIC_API_KEY (v1)
- Owner adds Wallet B to allowlist (v1)
- Wallet B calls getSecret → returns ciphertext ✓
- Owner revokes secret (version increments)
- Owner re-registers ANTHROPIC_API_KEY (v2)
- Wallet B calls getSecret ✗ (not in allowlist - v1 entry invalid!)
- Owner adds Wallet B to allowlist (v2)
- Wallet B calls getSecret → returns ciphertext ✓

#### Test 7: Remove from Allowlist
- Owner registers XAI_API_KEY
- Owner adds Wallet B to allowlist
- Wallet B calls getSecret → returns ciphertext ✓
- Owner removes Wallet B from allowlist
- Wallet B calls getSecret ✗ (not in allowlist)
- Owner adds Wallet B back
- Wallet B calls getSecret → returns ciphertext ✓

#### Test 8: Privacy Audit
- Use Oasis Explorer to verify:
  - [ ] Ciphertext never visible in transaction calldata
  - [ ] Ciphertext never visible in event logs
  - [ ] Only providerId in events
  - [ ] Encrypted calldata shows "green lock" icon

### Verification Checklist

- [ ] No plaintext in events (check Oasis Explorer)
- [ ] Encrypted calldata on transactions
- [ ] Only valid provider IDs accepted
- [ ] Only owner can register/modify their secrets
- [ ] Allowlist enforced correctly with versioning
- [ ] Unauthenticated view calls fail with address(0)
- [ ] Revoke invalidates allowlist via version increment

## Security Considerations

1. **Signed Queries**: `getSecret` (view) requires authenticated call via `sapphire.wrap`; unauthenticated view calls have `msg.sender = address(0)` on Sapphire
2. **No Plaintext Leaks**: Events only log `providerId`, never ciphertext
3. **Versioning**: Revoke/re-register invalidates all previous allowlist entries
4. **Access Control**: Each owner's secrets are isolated; only they can manage allowlists
5. **Provider Validation**: Only predefined provider IDs accepted, preventing typos/inconsistencies

## Standard Provider IDs Reference

| Constant | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `keccak256(abi.encodePacked("ANTHROPIC_API_KEY"))` |
| `OPENAI_API_KEY` | `keccak256(abi.encodePacked("OPENAI_API_KEY"))` |
| `XAI_API_KEY` | `keccak256(abi.encodePacked("XAI_API_KEY"))` |
| `OPENROUTER_API_KEY` | `keccak256(abi.encodePacked("OPENROUTER_API_KEY"))` |
| `ZAI_API_KEY` | `keccak256(abi.encodePacked("ZAI_API_KEY"))` |
| `GOOGLE_API_KEY` | `keccak256(abi.encodePacked("GOOGLE_API_KEY"))` |
