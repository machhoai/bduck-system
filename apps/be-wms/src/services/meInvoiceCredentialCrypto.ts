import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
  tag: string;
  key_version: "v1";
}

const getConfiguredKey = () => {
  const value = process.env.MEINVOICE_CONFIG_ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error("MEINVOICE_CONFIG_ENCRYPTION_KEY is required.");
  }
  return value;
};

const deriveKey = (rawKey: string) =>
  createHash("sha256").update(rawKey, "utf8").digest();

const aadFor = (context: string) => Buffer.from(`meinvoice:${context}:v1`, "utf8");

export const createMeInvoiceCredentialCrypto = (
  rawKey: string = getConfiguredKey(),
) => ({
  encrypt(value: string, context: string): EncryptedCredential {
    const normalized = value.trim();
    if (!normalized) throw new Error("Credential value cannot be empty.");

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", deriveKey(rawKey), iv);
    cipher.setAAD(aadFor(context));
    const ciphertext = Buffer.concat([
      cipher.update(normalized, "utf8"),
      cipher.final(),
    ]);

    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      key_version: "v1",
    };
  },

  decrypt(value: EncryptedCredential, context: string): string {
    if (value.key_version !== "v1") {
      throw new Error(`Unsupported meInvoice encryption key version: ${value.key_version}`);
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(rawKey),
      Buffer.from(value.iv, "base64"),
    );
    decipher.setAAD(aadFor(context));
    decipher.setAuthTag(Buffer.from(value.tag, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  },
});

