export interface EncryptedPayload {
  ciphertext: string; // hex encoded
  iv: string;         // hex encoded (12 bytes for GCM)
  authTag: string;    // hex encoded (16 bytes for GCM)
  version?: number;
}
