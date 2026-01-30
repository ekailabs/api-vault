# EkaiControlPlane

A confidential control plane for ROFL apps on Oasis Sapphire. Secrets are encrypted to a ROFL key (decrypted only in the enclave), with shared delegate allowlists and optional per-provider model restrictions.

## Deployed Contracts

| Network | Address |
|---------|---------|
| Sapphire Testnet | `0x8C9ab7C940d39e535F0d06E23bcF627f482e61b0` |

## Quickstart

```bash
npm install
npx hardhat compile
npx hardhat test
```

Deploy to Sapphire testnet:

```bash
export PRIVATE_KEY="your-private-key"
npx hardhat deploy-ekai --network sapphire-testnet
```

## Hardhat Tasks

```bash
# Deploy
npx hardhat deploy-ekai --network sapphire-testnet

# Admin (owner only)
npx hardhat ekai-add-provider --address <addr> --provider OPENAI --network sapphire-testnet
npx hardhat ekai-remove-provider --address <addr> --provider OPENAI --network sapphire-testnet
npx hardhat ekai-set-gateway --address <addr> --gateway <addr> --network sapphire-testnet
npx hardhat ekai-set-rofl-key --address <addr> --pubkey 0x... --keyversion 1 --network sapphire-testnet

# Secrets
npx hardhat ekai-set-secret --address <addr> --provider OPENAI --secret "sk-..." --network sapphire-testnet
npx hardhat ekai-revoke-secret --address <addr> --provider OPENAI --network sapphire-testnet
npx hardhat ekai-get-secret-info --address <addr> --owner <addr> --provider OPENAI --network sapphire-testnet

# Delegates
npx hardhat ekai-add-delegate --address <addr> --delegate <addr> --network sapphire-testnet
npx hardhat ekai-remove-delegate --address <addr> --delegate <addr> --network sapphire-testnet
npx hardhat ekai-check-delegate --address <addr> --owner <addr> --delegate <addr> --network sapphire-testnet

# Models
npx hardhat ekai-add-model --address <addr> --provider OPENAI --model gpt-4 --network sapphire-testnet
npx hardhat ekai-remove-model --address <addr> --provider OPENAI --model gpt-4 --network sapphire-testnet
npx hardhat ekai-check-model --address <addr> --owner <addr> --provider OPENAI --model gpt-4 --network sapphire-testnet

# Info
npx hardhat ekai-info --address <addr> --network sapphire-testnet

# Demo (localnet)
npx hardhat ekai-demo --network sapphire-localnet
```

## Browser Testing

```bash
# Serve frontend
npx http-server . -p 8080 --cors

# Open http://localhost:8080/frontend/ekai.html
```

## Key Concepts

- **Providers**: Admin-managed registry (OPENAI, ANTHROPIC, etc.)
- **Secrets**: Per-user, per-provider encrypted data
- **Delegates**: Shared access to ALL owner's secrets (delegateCount=0 means only owner)
- **Models**: Per-provider restrictions (modelCount=0 means all allowed)

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| Sapphire Mainnet | 0x5afe | https://sapphire.oasis.io |
| Sapphire Testnet | 0x5aff | https://testnet.sapphire.oasis.io |
| Sapphire Localnet | 0x5afd | http://localhost:8545 |

Run local node:
```bash
docker run -it -p8544-8548:8544-8548 ghcr.io/oasisprotocol/sapphire-localnet
```

## License

MIT
