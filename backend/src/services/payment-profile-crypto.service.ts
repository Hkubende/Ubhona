import crypto from "node:crypto";

const PAYMENT_PROFILE_KEY_BYTES = 32;

type EncryptedSecretBlob = {
  alg: "aes-256-gcm";
  keyVersion: "v1";
  iv: string;
  ciphertext: string;
  tag: string;
};

function getEncryptionKeyMaterial() {
  const raw = String(process.env.PAYMENT_PROFILE_ENCRYPTION_KEY || "").trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "Missing or weak PAYMENT_PROFILE_ENCRYPTION_KEY. Set a strong secret (>=32 chars) before managing payment profiles."
    );
  }
  return crypto.createHash("sha256").update(raw).digest().subarray(0, PAYMENT_PROFILE_KEY_BYTES);
}

export type PaymentProfileSecretInput = {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
};

export type PaymentProfileSecretOutput = PaymentProfileSecretInput;

export type PaymentProfileEncryptedSecrets = EncryptedSecretBlob;

export function encryptPaymentProfileSecrets(input: PaymentProfileSecretInput): PaymentProfileEncryptedSecrets {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKeyMaterial(), iv);
  const plaintext = Buffer.from(JSON.stringify(input), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "aes-256-gcm",
    keyVersion: "v1",
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: tag.toString("base64url"),
  };
}

export function decryptPaymentProfileSecrets(input: PaymentProfileEncryptedSecrets): PaymentProfileSecretOutput {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKeyMaterial(),
    Buffer.from(input.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(input.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64url")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(plaintext.toString("utf8")) as Partial<PaymentProfileSecretOutput>;
  if (!parsed.consumerKey || !parsed.consumerSecret || !parsed.passkey) {
    throw new Error("Stored payment profile secrets are incomplete.");
  }
  return {
    consumerKey: parsed.consumerKey,
    consumerSecret: parsed.consumerSecret,
    passkey: parsed.passkey,
  };
}