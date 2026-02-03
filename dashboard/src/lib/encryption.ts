import { X25519DeoxysII, CipherKind } from '@oasisprotocol/sapphire-paratime';
import { encode } from 'cborg';

/**
 * Encrypts a secret using X25519-DeoxysII for the gateway enclave.
 *
 * @param secret - The plaintext secret (e.g., API key)
 * @param roflPublicKey - The gateway's public key from getRoflKey()
 * @returns CBOR-encoded envelope ready for on-chain storage
 */
export function encryptSecret(
  secret: string,
  roflPublicKey: Uint8Array
): Uint8Array {
  // Create cipher with ephemeral keypair
  const cipher = X25519DeoxysII.ephemeral(roflPublicKey);

  // Encrypt the secret
  const secretBytes = new TextEncoder().encode(secret);
  const { ciphertext, nonce } = cipher.encrypt(secretBytes);

  // Build envelope matching gateway's expected format
  const envelope = {
    format: CipherKind.X25519DeoxysII,
    body: {
      pk: cipher.publicKey,
      nonce: nonce,
      data: ciphertext,
    },
  };

  // CBOR encode for on-chain storage
  return encode(envelope);
}

/**
 * Converts a hex string (with or without 0x prefix) to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}
