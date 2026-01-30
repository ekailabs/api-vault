# CLAUDE.md

Guidance for Claude Code when working with this repository.

## What Is This?

Ekai Control Plane - share your AI API keys with anyone without revealing them. Keys are encrypted on-chain and only decrypted inside a secure enclave (TEE). No one ever sees your keys - not delegates, not node operators, not even us.

Works with the [Ekai Gateway](https://github.com/ekailabs/ekai-gateway) which runs in the enclave and makes API calls on behalf of authorized users.

## Deployed Contract

| Network | Address | Owner |
|---------|---------|-------|
| Sapphire Testnet | `0x1647A17be7Ad7A01C6657aC05FA10349E7f32268` | `0x4Ec6E3b99E2E4422d6e64313F5AA2A8470DCDa2b` |

## Commands

```bash
npm install
npx hardhat compile
npx hardhat test

# Deploy
npx hardhat deploy-ekai --network sapphire-testnet

# Setup (adds all providers)
npx hardhat ekai-setup --address <contract> --network sapphire-testnet

# Store a secret
npx hardhat ekai-set-secret --address <contract> --provider ANTHROPIC --secret "sk-ant-..." --network sapphire-testnet

# Share with someone
npx hardhat ekai-add-delegate --address <contract> --delegate 0x... --network sapphire-testnet
```

## Networks

| Network | Chain ID | Env |
|---------|----------|-----|
| `sapphire` | 0x5afe | Mainnet |
| `sapphire-testnet` | 0x5aff | Testnet |
| `sapphire-localnet` | 0x5afd | Local (localhost:8545) |

Set `PRIVATE_KEY` env var for transactions.

## Contract API

### Owner Functions

| Function | Description |
|----------|-------------|
| `setGateway(address)` | Set trusted gateway for non-ROFL auth |
| `clearGateway()` | Remove gateway |
| `setRoflAppId(bytes21)` | Set ROFL app ID for native Sapphire auth |
| `clearRoflAppId()` | Remove ROFL app ID |
| `setRoflKey(bytes, bool)` | Set encryption public key (version auto-increments) |
| `setRoflKeyActive(bool)` | Toggle key active state |
| `addProvider(bytes32)` | Add provider (OPENAI, ANTHROPIC, etc.) |
| `removeProvider(bytes32)` | Remove provider |
| `pause()` | Emergency stop (blocks adds, allows revokes) |
| `unpause()` | Resume normal operation |

### User Functions

| Function | Description |
|----------|-------------|
| `setSecret(bytes32 providerId, bytes ciphertext)` | Store encrypted API key |
| `revokeSecret(bytes32 providerId)` | Delete your secret |
| `addDelegate(address)` | Let someone use your keys |
| `removeDelegate(address)` | Revoke access |
| `addAllowedModel(bytes32 providerId, bytes32 modelId)` | Restrict to specific model |
| `removeAllowedModel(bytes32 providerId, bytes32 modelId)` | Remove restriction |

### View Functions

| Function | Description |
|----------|-------------|
| `getSecretCiphertext(address, bytes32)` | Get encrypted secret (anyone can call - ciphertext is useless without enclave) |
| `isDelegatePermitted(address owner, address delegate)` | Check if delegate allowed |
| `isModelPermitted(address owner, bytes32 providerId, bytes32 modelId)` | Check if model allowed |
| `getRoflKey()` | Get public key, version, active status |

### Gateway Functions

| Function | Description |
|----------|-------------|
| `logReceipt(...)` | Log API usage (versions read from storage, can't be spoofed) |

## Key Concepts

**Providers**: OPENAI, ANTHROPIC, GOOGLE, XAI, OPENROUTER, GROQ. Admin-managed registry.

**Secrets**: Your encrypted API keys. One per provider. Version increments on change.

**Delegates**: People who can use your keys. Shared across all your secrets. Remove anytime.

**Models**: Optional per-provider restrictions. Empty = allow all models.

**ROFL Key**: Gateway's public encryption key. Must be active before users can store secrets.

## Security Model

Why no access control on `getSecretCiphertext()`?

On Sapphire, unsigned view calls have `msg.sender = address(0)`. Access control would break the gateway. The ciphertext is encrypted to the gateway's key - useless to anyone else.

The gateway checks `isDelegatePermitted()` and `isModelPermitted()` before decrypting.

See [SECURITY.md](SECURITY.md) for full details.

## Solidity

- Version: 0.8.24, Paris EVM
- OpenZeppelin: `Ownable2Step`
- Oasis: `@oasisprotocol/sapphire-contracts` for ROFL verification

## Config

Contract addresses in `config.json`. Frontend loads from there.
