package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

const (
	contractAddr = "0x440222b531537ac1A90dbDF906D36Be0536e4Ec8"
	ownerAddr    = "0x4Ec6E3b99E2E4422d6e64313F5AA2A8470DCDa2b"
	rpcURL       = "https://testnet.sapphire.oasis.io"
)

// Minimal ABI
const abiJSON = `[
	{
		"inputs": [{"name": "owner", "type": "address"},{"name": "providerId", "type": "bytes32"}],
		"name": "getSecret",
		"outputs": [{"name": "", "type": "bytes"}],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{"name": "owner", "type": "address"},{"name": "providerId", "type": "bytes32"}],
		"name": "getSecretInfo",
		"outputs": [{"name": "version", "type": "uint64"},{"name": "exists", "type": "bool"},{"name": "isAllowed", "type": "bool"}],
		"stateMutability": "view",
		"type": "function"
	}
]`

func main() {
	privateKeyHex := os.Getenv("PRIVATE_KEY")
	if privateKeyHex == "" {
		log.Fatal("PRIVATE_KEY env var required")
	}
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		log.Fatalf("Invalid private key: %v", err)
	}

	publicKey := privateKey.Public().(*ecdsa.PublicKey)
	signerAddr := crypto.PubkeyToAddress(*publicKey)
	fmt.Printf("Signer address: %s\n\n", signerAddr.Hex())

	// Standard ethclient (without Sapphire wrapper for comparison)
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer client.Close()

	chainID, _ := client.ChainID(context.Background())
	fmt.Printf("Connected to chain ID: %v\n\n", chainID)

	parsedABI, err := abi.JSON(strings.NewReader(abiJSON))
	if err != nil {
		log.Fatalf("Failed to parse ABI: %v", err)
	}

	contract := common.HexToAddress(contractAddr)
	owner := common.HexToAddress(ownerAddr)
	providerId := crypto.Keccak256Hash([]byte("OPENAI_API_KEY"))

	// Test: Unsigned call (should show isAllowed = false)
	fmt.Println("--- Unsigned eth_call (for comparison) ---")
	callData, _ := parsedABI.Pack("getSecretInfo", owner, providerId)

	result, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   &contract,
		Data: callData,
	}, nil)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		res, _ := parsedABI.Unpack("getSecretInfo", result)
		fmt.Printf("Version: %v, Exists: %v, IsAllowed: %v\n", res[0], res[1], res[2])
	}

	// For signed queries, we need sapphire-paratime Go client
	// The issue is the dependency - let me try building from Oasis example
	fmt.Println("\n--- Note ---")
	fmt.Println("To test signed queries, we need the sapphire-paratime Go client.")
	fmt.Println("The dependency has version conflicts. Let me try the Python client instead.")

	_ = privateKey
	_ = big.NewInt(0)
}
