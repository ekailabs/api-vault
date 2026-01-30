#!/usr/bin/env python3
"""Test signed queries on Sapphire using sapphirepy"""

import os
from eth_account import Account
from web3 import Web3
from sapphirepy import sapphire

CONTRACT = "0x440222b531537ac1A90dbDF906D36Be0536e4Ec8"
OWNER = "0x4Ec6E3b99E2E4422d6e64313F5AA2A8470DCDa2b"
RPC_URL = "https://testnet.sapphire.oasis.io"

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
    }
]

def main():
    private_key = os.environ.get("PRIVATE_KEY")
    if not private_key:
        raise ValueError("PRIVATE_KEY env var required")

    account = Account.from_key(private_key)
    print(f"Signer address: {account.address}\n")

    # Create Web3 with Sapphire wrapper for signed queries
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    w3 = sapphire.wrap(w3, account)

    print(f"Connected to chain ID: {w3.eth.chain_id}\n")

    contract = w3.eth.contract(address=CONTRACT, abi=ABI)
    provider_id = Web3.keccak(text="OPENAI_API_KEY")

    # Test 1: getSecretInfo with signed query
    print("--- Test 1: getSecretInfo (signed query) ---")
    try:
        result = contract.functions.getSecretInfo(OWNER, provider_id).call()
        print(f"Version: {result[0]}")
        print(f"Exists: {result[1]}")
        print(f"IsAllowed: {result[2]}  <-- Should be TRUE with signed query!")
    except Exception as e:
        print(f"Error: {e}")

    # Test 2: getSecret with signed query
    print("\n--- Test 2: getSecret (signed query) ---")
    try:
        secret_bytes = contract.functions.getSecret(OWNER, provider_id).call()
        secret = secret_bytes.decode('utf-8')
        print(f"Secret retrieved: {secret}")
    except Exception as e:
        print(f"Error: {e}")

    print("\n=== Test Complete ===")

if __name__ == "__main__":
    main()
