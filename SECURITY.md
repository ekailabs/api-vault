# Security Model

## The Core Guarantee

**Your API keys are never revealed to anyone.** Not to your delegates. Not to node operators. Not to us.

Keys are encrypted on-chain using the gateway's public key. The only place they're ever decrypted is inside the gateway's secure enclave (TEE) - a hardware-isolated environment that even the server operator cannot access.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU: Encrypt API key with gateway's public key                 │
│       Store ciphertext on-chain                                 │
│       (Ciphertext is public, but useless without private key)   │
├─────────────────────────────────────────────────────────────────┤
│  EKAI GATEWAY (inside TEE):                                     │
│  1. Read ciphertext from chain                                  │
│  2. Check: Is caller on your delegate list?                     │
│  3. Check: Is requested model allowed?                          │
│  4. Decrypt key (only possible inside enclave)                  │
│  5. Make API call to OpenAI/Anthropic/etc                       │
│  6. Log usage receipt on-chain                                  │
│  7. Return response to caller                                   │
│                                                                 │
│  Private key never leaves the enclave.                          │
│  Not even memory dumps can extract it.                          │
└─────────────────────────────────────────────────────────────────┘
```

## Why No Access Control on Ciphertext?

On Oasis Sapphire, unsigned view calls have `msg.sender = address(0)`. If we added access control to `getSecretCiphertext()`, the gateway couldn't read it.

This is fine because:
- The ciphertext is encrypted to the gateway's public key
- Only the gateway's enclave has the private key
- Raw ciphertext is useless to anyone else

The gateway enforces access control by checking `isDelegatePermitted()` and `isModelPermitted()` before decrypting and using the key.

## What We Protect Against

| Threat | Protection |
|--------|------------|
| Delegate sees your API key | Impossible - decryption only happens in enclave |
| Node operator extracts keys | TEE isolation prevents memory access |
| Someone uses your key without permission | Gateway checks delegate list on-chain |
| Delegate uses expensive model you didn't allow | Gateway checks model allowlist |
| Leaked key | Revoke delegate instantly; key itself was never exposed |
| Replay attacks | Receipts include request hash, timestamp, versions |
| Admin accidentally bricks contract | Two-step ownership, pause/unpause, clear functions |

## What We Don't Protect Against

| Threat | Why |
|--------|-----|
| Compromised TEE hardware | If Intel SGX/TDX is broken, all bets are off |
| Malicious contract owner | Owner controls gateway address and ROFL key |
| You share with a malicious delegate | They can use your key (but still can't see it) |

## Contract Security Features

### ROFL Verification

Two methods to verify the gateway:

1. **ROFL App ID** (preferred): Uses Sapphire's native `Subcall.roflEnsureAuthorizedOrigin()` - cryptographic proof that the caller is the registered ROFL app.

2. **Gateway Address** (fallback): Traditional `msg.sender` check for testing or non-ROFL deployments.

### Version Tracking

- ROFL key version auto-increments on rotation
- Secret version auto-increments on set/revoke
- `logReceipt()` reads versions from storage (can't be spoofed)
- Stale secrets are detectable by comparing versions

### Emergency Controls

| Control | Purpose |
|---------|---------|
| `pause()` | Blocks new secrets/delegates/models |
| Revoke operations | Always work, even when paused |
| `clearGateway()` | Emergency removal of gateway auth |
| `clearRoflAppId()` | Emergency removal of ROFL auth |

### Input Validation

All inputs are validated:
- No zero addresses for gateway, delegates
- No zero bytes for ROFL app ID, providers, models
- No empty ciphertext for secrets
- ROFL key must be active before setting secrets

### Gas Efficiency

Custom errors instead of string reverts save ~200 gas per revert:

```solidity
error InvalidGateway();
error InvalidDelegate();
error RoflKeyNotActive();
error NotAuthorized();
// etc.
```

## The Bottom Line

Share access to your API keys with anyone. They can use them through the gateway. They can never see them. You can revoke anytime. The keys exist only inside a hardware-protected enclave that no one - not even the server operators - can access.
