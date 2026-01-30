# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EkaiControlPlane - a confidential control plane for ROFL apps on Oasis Sapphire. Secrets are encrypted to a ROFL key (decrypted only in the enclave), with shared delegate allowlists and optional per-provider model restrictions.

## Deployed Contracts

| Network | Address | Owner |
|---------|---------|-------|
| Sapphire Testnet | `0x8C9ab7C940d39e535F0d06E23bcF627f482e61b0` | `0x4Ec6E3b99E2E4422d6e64313F5AA2A8470DCDa2b` |

## Commands

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy EkaiControlPlane
npx hardhat deploy-ekai --network sapphire-testnet

# Add a provider (admin only)
npx hardhat ekai-add-provider --address <contract> --provider OPENAI --network sapphire-testnet

# Set a secret
npx hardhat ekai-set-secret --address <contract> --provider OPENAI --secret "sk-..." --network sapphire-testnet

# Add a delegate
npx hardhat ekai-add-delegate --address <contract> --delegate <address> --network sapphire-testnet

# Add model restriction
npx hardhat ekai-add-model --address <contract> --provider OPENAI --model gpt-4 --network sapphire-testnet

# Check permissions
npx hardhat ekai-check-delegate --address <contract> --owner <owner> --delegate <delegate> --network sapphire-testnet
npx hardhat ekai-check-model --address <contract> --owner <owner> --provider OPENAI --model gpt-4 --network sapphire-testnet

# Get contract info
npx hardhat ekai-info --address <contract> --network sapphire-testnet

# Full demo (localnet)
npx hardhat ekai-demo --network sapphire-localnet

# Run local Sapphire node
docker run -it -p8544-8548:8544-8548 ghcr.io/oasisprotocol/sapphire-localnet

# Serve frontend for browser testing
npx http-server . -p 8080 --cors
# Then open: http://localhost:8080/frontend/ekai.html
```

## Networks

- `sapphire` - Mainnet (chainId: 0x5afe)
- `sapphire-testnet` - Testnet (chainId: 0x5aff)
- `sapphire-localnet` - Local dev at localhost:8545 (chainId: 0x5afd)

Set `PRIVATE_KEY` env var for deployment; defaults to test mnemonic.

## Architecture

**EkaiControlPlane Contract** (`contracts/EkaiControlPlane.sol`):

### Access Control
- **Admin (Ownable2Step)**: setGateway, setRoflKey, addProvider, removeProvider
- **Users**: Manage their own secrets, delegates, and model restrictions
- **Gateway**: Log receipts (audit trail)

### Key Concepts

**Providers**: Admin-managed registry of valid provider IDs (e.g., OPENAI, ANTHROPIC). Users can only store secrets for valid providers.

**Secrets**: Per-user, per-provider encrypted data. Version increments on each set/revoke.

**Delegates**: Shared across ALL of an owner's secrets. If delegateCount == 0, only owner has access. Self-access (owner == delegate) always permitted.

**Models**: Per-provider restrictions. If modelCount == 0, ALL models allowed. Otherwise, only whitelisted models permitted.

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `setGateway(address)` | Owner | Set trusted ROFL gateway |
| `setRoflKey(bytes, uint64, bool)` | Owner | Set/rotate ROFL encryption key |
| `addProvider(bytes32)` | Owner | Add valid provider to registry |
| `setSecret(bytes32, bytes)` | Any | Store secret for a provider |
| `revokeSecret(bytes32)` | Any | Delete own secret |
| `addDelegate(address)` | Any | Grant delegate access to all secrets |
| `removeDelegate(address)` | Any | Revoke delegate access |
| `addAllowedModel(bytes32, bytes32)` | Any | Restrict provider to specific model |
| `removeAllowedModel(bytes32, bytes32)` | Any | Remove model restriction |
| `getSecretCiphertext(address, bytes32)` | View | Get encrypted secret + metadata |
| `isDelegatePermitted(address, address)` | View | Check delegate permission |
| `isModelPermitted(address, bytes32, bytes32)` | View | Check model permission |
| `logReceipt(...)` | Gateway | Emit audit event |

### Typical ROFL Gateway Flow

1. `getSecretCiphertext(owner, providerId)` → get ciphertext + versions
2. `isDelegatePermitted(owner, delegate)` → verify delegate access
3. `isModelPermitted(owner, providerId, modelId)` → verify model allowed
4. Decrypt ciphertext in enclave, make API call
5. `logReceipt(...)` → emit audit event

## Solidity

Version 0.8.24 with Paris EVM. The `@oasisprotocol/sapphire-hardhat` plugin automatically wraps providers with Sapphire's encryption layer.

## Frontend

Browser-based test UI at `frontend/ekai.html`. Uses `@oasisprotocol/sapphire-paratime` for encrypted transactions.
