# Oasis Sapphire API Key Vault

A secure, policy-driven vault for managing encrypted API keys on Oasis Sapphire with per-provider allowlists and versioned revocation. Secrets are stored encrypted; only allowlisted addresses for the current version can fetch them via authenticated Sapphire view calls.

## Quickstart

```bash
npm install
npx hardhat compile
```

Deploy to Sapphire testnet (uses `PRIVATE_KEY` or the test mnemonic):

```bash
npx hardhat deploy-vault --network sapphire-testnet
```

Run the scripted demo (deploy, register, allowlist, info, audit log):

```bash
npx hardhat full-vault-demo --network sapphire-localnet
```

## Hardhat Tasks

- `deploy-vault` — deploy the `APIKeyVault` contract
- `register-secret --address <addr> --provider OPENAI_API_KEY --secret "sk-..."`
- `add-allowlist --address <addr> --provider OPENAI_API_KEY --user <wallet>`
- `remove-allowlist --address <addr> --provider OPENAI_API_KEY --user <wallet>`
- `get-secret --address <addr> --owner <owner> --provider OPENAI_API_KEY`
- `log-access --address <addr> --owner <owner> --provider OPENAI_API_KEY`
- `revoke-secret --address <addr> --provider OPENAI_API_KEY`
- `get-secret-info --address <addr> --owner <owner> --provider OPENAI_API_KEY`
- `full-vault-demo` — end-to-end walkthrough

Provider IDs are fixed: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `ZAI_API_KEY`, `GOOGLE_API_KEY`.

## Sapphire Authentication Note

`getSecret` is an authenticated view. On Sapphire, unsigned view calls set `msg.sender = address(0)` and will revert as unauthenticated. Use signed queries (e.g., `sapphire.wrap` with MetaMask/SIWE) when reading secrets; normal transactions (e.g., `logAccess`) do not require this.

## Networks

- `sapphire` (mainnet): `https://sapphire.oasis.io`, chainId `0x5afe`
- `sapphire-testnet`: `https://testnet.sapphire.oasis.io`, chainId `0x5aff`
- `sapphire-localnet`: `http://localhost:8545`, chainId `0x5afd` (see `docker run -it -p8544-8548:8544-8548 ghcr.io/oasisprotocol/sapphire-localnet`)

Set `PRIVATE_KEY` for deployments; otherwise the test mnemonic is used.
