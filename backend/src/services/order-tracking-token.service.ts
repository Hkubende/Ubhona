import crypto from "node:crypto";

type TrackingTokenClaims = {
  v: 1;
  oid: string;
  rid: string;
  iat: number;
  exp: number;
};

type IssueTrackingTokenInput = {
  orderId: string;
  restaurantId: string;
  ttlSeconds?: number;
};

function readTrackingSecret() {
  const value = String(process.env.ORDER_TRACKING_SECRET || process.env.JWT_SECRET || "").trim();
  if (!value || value === "dev-secret" || value.length < 32) {
    throw new Error(
      "Missing or weak ORDER_TRACKING_SECRET/JWT_SECRET. Set a strong secret (>=32 chars) before starting backend."
    );
  }
  return value;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signPayload(payloadB64: string) {
  return crypto.createHmac("sha256", readTrackingSecret()).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function issueOrderTrackingToken(input: IssueTrackingTokenInput) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(60, Math.min(60 * 60 * 24 * 14, Math.floor(input.ttlSeconds ?? 60 * 60 * 24 * 3)));
  const payload: TrackingTokenClaims = {
    v: 1,
    oid: input.orderId,
    rid: input.restaurantId,
    iat: now,
    exp: now + ttl,
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyOrderTrackingToken(token: string, expectedOrderId?: string) {
  const raw = String(token || "").trim();
  const [payloadB64, signature] = raw.split(".");
  if (!payloadB64 || !signature) {
    throw new Error("Invalid order tracking token.");
  }
  const expectedSig = signPayload(payloadB64);
  if (!safeEqual(signature, expectedSig)) {
    throw new Error("Invalid order tracking token signature.");
  }
  const decoded = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as Partial<TrackingTokenClaims>;
  if (decoded.v !== 1 || !decoded.oid || !decoded.rid || !decoded.exp) {
    throw new Error("Invalid order tracking token payload.");
  }
  if (expectedOrderId && decoded.oid !== expectedOrderId) {
    throw new Error("Order tracking token does not match requested order.");
  }
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp <= now) {
    throw new Error("Order tracking token expired.");
  }
  return {
    orderId: decoded.oid,
    restaurantId: decoded.rid,
    exp: decoded.exp,
  };
}

