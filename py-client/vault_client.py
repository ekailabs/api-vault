#!/usr/bin/env python3
"""
APIKeyVault Python Client with Signed Queries

Usage:
    python vault_client.py get-secret <contract> <owner> <provider>
    python vault_client.py get-info <contract> <owner> <provider>
    python vault_client.py whoami <contract>

Environment:
    PRIVATE_KEY - Wallet private key (with 0x prefix)
"""

import os
import sys
from eth_account import Account
from web3 import Web3
from sapphirepy import sapphire
from dotenv import load_dotenv

load_dotenv()

RPC_URL = "https://testnet.sapphire.oasis.io"
CHAIN_ID = 0x5aff

# Minimal ABI
ABI = [
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "providerId", "type": "bytes32"}
        ],
        "name": "getSecret",
        "outputs": [{"name": "", "type": "bytes"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "providerId", "type": "bytes32"}
        ],
        "name": "getSecretInfo",
        "outputs": [
            {"name": "version", "type": "uint64"},
            {"name": "exists", "type": "bool"},
            {"name": "isAllowed", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "whoAmI",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]

PROVIDERS = {
    "ANTHROPIC_API_KEY": Web3.keccak(text="ANTHROPIC_API_KEY"),
    "OPENAI_API_KEY": Web3.keccak(text="OPENAI_API_KEY"),
    "XAI_API_KEY": Web3.keccak(text="XAI_API_KEY"),
    "OPENROUTER_API_KEY": Web3.keccak(text="OPENROUTER_API_KEY"),
    "ZAI_API_KEY": Web3.keccak(text="ZAI_API_KEY"),
    "GOOGLE_API_KEY": Web3.keccak(text="GOOGLE_API_KEY"),
}


def get_client():
    """Create Web3 client with Sapphire signed query support."""
    private_key = os.environ.get("PRIVATE_KEY")
    if not private_key:
        raise ValueError("PRIVATE_KEY environment variable required")

    account = Account.from_key(private_key)
    w3 = Web3(Web3.HTTPProvider(RPC_URL))

    # Wrap with Sapphire for signed queries
    w3 = sapphire.wrap(w3, account)

    return w3, account


def get_secret(contract_addr: str, owner: str, provider: str):
    """Retrieve a secret using signed query."""
    w3, account = get_client()

    print(f"Caller: {account.address}")
    print(f"Owner: {owner}")
    print(f"Provider: {provider}")

    provider_id = PROVIDERS.get(provider)
    if not provider_id:
        print(f"Unknown provider. Valid: {', '.join(PROVIDERS.keys())}")
        return

    contract = w3.eth.contract(address=contract_addr, abi=ABI)

    try:
        secret_bytes = contract.functions.getSecret(owner, provider_id).call()
        secret = secret_bytes.decode('utf-8')
        print(f"\n✓ Secret: {secret}")
    except Exception as e:
        print(f"\n✗ Error: {e}")


def get_info(contract_addr: str, owner: str, provider: str):
    """Get secret info using signed query."""
    w3, account = get_client()

    print(f"Caller: {account.address}")

    provider_id = PROVIDERS.get(provider)
    if not provider_id:
        print(f"Unknown provider. Valid: {', '.join(PROVIDERS.keys())}")
        return

    contract = w3.eth.contract(address=contract_addr, abi=ABI)

    try:
        result = contract.functions.getSecretInfo(owner, provider_id).call()
        print(f"\nVersion: {result[0]}")
        print(f"Exists: {result[1]}")
        print(f"IsAllowed: {result[2]}  <-- Should be True with signed query")
    except Exception as e:
        print(f"\n✗ Error: {e}")


def whoami(contract_addr: str):
    """Test signed queries by checking msg.sender."""
    w3, account = get_client()

    print(f"Expected: {account.address}")

    # Need to add whoAmI to contract for this test
    abi_with_whoami = ABI + [{
        "inputs": [],
        "name": "whoAmI",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }]

    contract = w3.eth.contract(address=contract_addr, abi=abi_with_whoami)

    try:
        result = contract.functions.whoAmI().call()
        print(f"Returned: {result}")

        if result == account.address:
            print("\n✓ Signed queries working!")
        elif result == "0x0000000000000000000000000000000000000000":
            print("\n✗ Unsigned (msg.sender = address(0))")
        else:
            print("\n? Unexpected result")
    except Exception as e:
        print(f"\n✗ Error: {e}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1]

    if cmd == "get-secret" and len(sys.argv) == 5:
        get_secret(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "get-info" and len(sys.argv) == 5:
        get_info(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "whoami" and len(sys.argv) == 3:
        whoami(sys.argv[2])
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
