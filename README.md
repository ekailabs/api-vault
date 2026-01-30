# Ekai Control Plane

**Share your AI API keys with anyone, without exposing them.**

Let your friends try Claude Opus from their favourite tool. Give a collaborator access to GPT-4 for a weekend project. Share your API keys without ever revealing them.

> **Your API keys are never revealed to anyone.**
> Not to your delegates. Not to node operators. Not even to us.
> Keys are encrypted on-chain and only decrypted inside a secure enclave (TEE) at the moment of use.

Ekai stores your encrypted API keys on [Oasis Sapphire](https://oasisprotocol.org/sapphire). The [Ekai Gateway](https://github.com/ekailabs/ekai-gateway) runs in a TEE enclave - the only place where keys are ever decrypted - and makes API calls on behalf of anyone you authorize.

## Why Ekai?

| Without Ekai | With Ekai |
|--------------|-----------|
| "Just paste this API key in your .env" | Add their wallet as delegate - done |
| Friend screenshots your key, posts it | Impossible - no one ever sees the key |
| No idea who used what | On-chain audit trail |
| Revoke = regenerate key + update everywhere | Remove delegate = instant revoke |

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  1. Store your API key (encrypted on-chain)                     │
│  2. Add a friend's wallet as delegate                           │
│  3. (Optional) Limit them to specific models                    │
├─────────────────────────────────────────────────────────────────┤
│  YOUR FRIEND                                                    │
│  1. Points Claude Code / Cursor / any app to Ekai Gateway       │
│  2. Gateway verifies they're on your delegate list              │
│  3. Gateway decrypts your key inside secure enclave             │
│  4. API call happens, response comes back                       │
│  5. Usage logged on-chain                                       │
└─────────────────────────────────────────────────────────────────┘
```

Your friend uses your API key without ever seeing it. No one does - not even the server operators.

## Quick Start

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Store Your First Secret

```bash
export PRIVATE_KEY="your-wallet-private-key"

# Store your Anthropic key
npx hardhat ekai-set-secret --address 0x1647A17be7Ad7A01C6657aC05FA10349E7f32268 \
  --provider ANTHROPIC --secret "sk-ant-..." --network sapphire-testnet

# Let a friend use it
npx hardhat ekai-add-delegate --address 0x1647A17be7Ad7A01C6657aC05FA10349E7f32268 \
  --delegate 0xFriendWalletAddress --network sapphire-testnet

# (Optional) Only allow Claude Sonnet, not Opus
npx hardhat ekai-add-model --address 0x1647A17be7Ad7A01C6657aC05FA10349E7f32268 \
  --provider ANTHROPIC --model claude-sonnet-4-20250514 --network sapphire-testnet
```

## Supported Providers

| Provider | ID |
|----------|-----|
| OpenAI | `OPENAI` |
| Anthropic | `ANTHROPIC` |
| Google | `GOOGLE` |
| xAI | `XAI` |
| OpenRouter | `OPENROUTER` |
| Groq | `GROQ` |

## Deployed Contract

| Network | Address |
|---------|---------|
| Sapphire Testnet | `0x1647A17be7Ad7A01C6657aC05FA10349E7f32268` |

## Architecture

```
┌──────────────┐     ┌─────────────────────────────────────────────────┐
│  Any App     │────▶│  Ekai Gateway (secure enclave)                  │
│              │     │                                                 │
│  Claude Code │     │  • Checks delegate permission                  │
│  Cursor      │     │  • Decrypts the right API key                  │
│  Continue    │     │  • Makes the API call                          │
│  Custom      │     │  • Logs usage on-chain                         │
└──────────────┘     └─────────────────────────────────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────────────┐
                     │  Control Plane (this repo)                      │
                     │                                                 │
                     │  • Your encrypted API keys                     │
                     │  • Who you've shared access with               │
                     │  • Model restrictions per person               │
                     │  • Usage receipts                              │
                     └─────────────────────────────────────────────────┘
```

- **Control Plane** (this repo): On-chain storage on [Oasis Sapphire](https://oasisprotocol.org/sapphire)
- **[Ekai Gateway](https://github.com/ekailabs/ekai-gateway)**: The proxy that decrypts and routes requests

## All Commands

### User Commands

```bash
# Store a secret (requires active ROFL key on the contract)
npx hardhat ekai-set-secret --address <addr> --provider OPENAI --secret "sk-..." --network sapphire-testnet

# Revoke your secret
npx hardhat ekai-revoke-secret --address <addr> --provider OPENAI --network sapphire-testnet

# Add/remove delegates
npx hardhat ekai-add-delegate --address <addr> --delegate <addr> --network sapphire-testnet
npx hardhat ekai-remove-delegate --address <addr> --delegate <addr> --network sapphire-testnet

# Add/remove model restrictions (empty = allow all models)
npx hardhat ekai-add-model --address <addr> --provider OPENAI --model gpt-4 --network sapphire-testnet
npx hardhat ekai-remove-model --address <addr> --provider OPENAI --model gpt-4 --network sapphire-testnet

# Check permissions
npx hardhat ekai-check-delegate --address <addr> --owner <addr> --delegate <addr> --network sapphire-testnet
npx hardhat ekai-check-model --address <addr> --owner <addr> --provider OPENAI --model gpt-4 --network sapphire-testnet
```

### Admin Commands

```bash
# Deploy new contract
npx hardhat deploy-ekai --network sapphire-testnet

# Setup (adds all providers + optional gateway/ROFL config)
npx hardhat ekai-setup --address <addr> [--gateway <addr>] [--roflappid <hex>] [--roflkey <hex>] --network sapphire-testnet

# Get contract info
npx hardhat ekai-info --address <addr> --network sapphire-testnet

# ROFL key management
npx hardhat ekai-set-rofl-key --address <addr> --pubkey <hex> --network sapphire-testnet
npx hardhat ekai-set-rofl-key-active --address <addr> --active true|false --network sapphire-testnet

# Emergency pause (blocks new secrets, allows revokes)
npx hardhat ekai-pause --address <addr> --network sapphire-testnet
npx hardhat ekai-unpause --address <addr> --network sapphire-testnet
```

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| Sapphire Mainnet | 0x5afe | https://sapphire.oasis.io |
| Sapphire Testnet | 0x5aff | https://testnet.sapphire.oasis.io |
| Sapphire Localnet | 0x5afd | http://localhost:8545 |

## Documentation

- [CLAUDE.md](CLAUDE.md) - Full API reference
- [SECURITY.md](SECURITY.md) - Security model and design decisions
- [Ekai Gateway](https://github.com/ekailabs/ekai-gateway) - The gateway that uses this control plane

## License

MIT
