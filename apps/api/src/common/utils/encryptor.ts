import * as crypto from 'crypto';

export type EncryptionKeys = {
  [key: number]: string | undefined;
};

type EncryptedData = {
  encrypted: string;
  iv: string;
  authTag: string;
};

function encryptConfig(data: string, encryptKey: string): EncryptedData {
  const keyBuffer = Buffer.from(encryptKey, 'base64');

  if (keyBuffer.length !== 32) {
    throw new Error(
      `Invalid encryption key length: expected 32 bytes, got ${keyBuffer.length}`,
    );
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

function decryptConfig(
  encryptedText: string,
  iv: string,
  authTag: string,
  encryptKey: string,
): string {
  // Match the same base64 decoding that's used in encryptConfig
  const keyBuffer = Buffer.from(encryptKey, 'base64');

  if (keyBuffer.length !== 32) {
    throw new Error(
      `Invalid encryption key length: expected 32 bytes, got ${keyBuffer.length}`,
    );
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keyBuffer,
    Buffer.from(iv, 'hex'),
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export { encryptConfig, decryptConfig };
