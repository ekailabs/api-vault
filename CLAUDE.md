# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oasis Sapphire API Key Vault - a secure, policy-driven Private Control Plane for managing API keys with access control. Uses Sapphire's confidential computing to keep secrets private.

## Commands

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy vault
npx hardhat deploy-vault --network sapphire-testnet

# Register a secret
npx hardhat register-secret --address <contract> --provider OPENAI_API_KEY --secret "sk-..." --network sapphire-testnet

# Add user to allowlist
npx hardhat add-allowlist --address <contract> --provider OPENAI_API_KEY --user <address> --network sapphire-testnet

# Get secret (as allowlisted user)
npx hardhat get-secret --address <contract> --owner <owner> --provider OPENAI_API_KEY --network sapphire-testnet

# Full demo
npx hardhat full-vault-demo --network sapphire-localnet

# Run local Sapphire node
docker run -it -p8544-8548:8544-8548 ghcr.io/oasisprotocol/sapphire-localnet
```

## Networks

- `sapphire` - Mainnet (chainId: 0x5afe)
- `sapphire-testnet` - Testnet (chainId: 0x5aff)
- `sapphire-localnet` - Local dev at localhost:8545 (chainId: 0x5afd)

Set `PRIVATE_KEY` env var for deployment; defaults to test mnemonic.

## Architecture

**APIKeyVault Contract** (`contracts/APIKeyVault.sol`):
- Owners register encrypted API keys for predefined providers (ANTHROPIC, OPENAI, XAI, OPENROUTER, ZAI, GOOGLE)
- Owners manage allowlists per secret
- Allowlisted addresses can retrieve secrets via authenticated view calls
- Versioning invalidates allowlists on revoke/re-register

**Key Functions:**
- `registerSecret(providerId, ciphertext)` - Store a secret
- `addToAllowlist(providerId, user)` - Grant access
- `removeFromAllowlist(providerId, user)` - Revoke access
- `getSecret(owner, providerId)` - Retrieve secret (authenticated view)
- `logAccess(owner, providerId)` - Audit trail (transaction)
- `revokeSecret(providerId)` - Delete secret, invalidate allowlist

**Sapphire-specific:**
- `getSecret` is a view function requiring signed queries for authenticated `msg.sender`
- Unauthenticated view calls have `msg.sender = address(0)` on Sapphire
- Events never contain plaintext secrets
- In Hardhat tasks, signed queries require SIWE setup - use production dApp with MetaMask for full testing

## Solidity

Version 0.8.24 with Paris EVM. The `@oasisprotocol/sapphire-hardhat` plugin automatically wraps providers with Sapphire's encryption layer.
