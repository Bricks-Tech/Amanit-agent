import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

/** Auth for Amanit tool calls (Place-Order): shared header secret. */
export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.WEBHOOK_SECRET;
  if (!configured) {
    return next();
  }

  const provided =
    req.header("x-webhook-secret") ??
    req.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    (typeof req.query.secret === "string" ? req.query.secret : undefined);

  if (provided !== configured) {
    return res.status(401).json({ error: "Invalid webhook secret" });
  }

  return next();
}

/**
 * Exact ElevenLabs post-call HMAC verification.
 * Secret: ELEVENLABS_WEBHOOK_SECRET (required — missing → 401).
 */
export function requireElevenLabsWebhook(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const sigHeader =
    req.header("elevenlabs-signature") ??
    req.header("ElevenLabs-Signature") ??
    req.header("x-elevenlabs-signature");

  if (!sigHeader) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const rawBody = req.rawBody;
  if (typeof rawBody !== "string") {
    return res.status(401).json({ error: "Invalid signature" });
  }

  if (!verifyElevenLabsSignature(rawBody, sigHeader, secret)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  return next();
}

/** Exported for unit-style checks / tests. */
export function verifyElevenLabsSignature(
  rawBody: string,
  sigHeader: string,
  secret: string
): boolean {
  const parsed = parseSignatureHeader(sigHeader);
  if (!parsed) return false;

  const { timestamp, hmacHex } = parsed;

  // Timestamp must be exactly 10 digits (unix seconds)
  if (!/^\d{10}$/.test(timestamp)) {
    return false;
  }

  const tsMs = Number(timestamp) * 1000;
  const now = Date.now();
  const skewMs = 30 * 60 * 1000;
  // Reject if age is outside ±30 minutes
  if (tsMs < now - skewMs || tsMs > now + skewMs) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  try {
    const a = Buffer.from(hmacHex, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Current:  t=<unix_timestamp_seconds>,v0=<hmac_hex>
 * Legacy:   v0=<timestamp>,<hmac_hex>
 */
function parseSignatureHeader(sigHeader: string): { timestamp: string; hmacHex: string } | null {
  const trimmed = sigHeader.trim();

  // Current format: t=...,v0=...
  if (trimmed.includes("t=") && trimmed.includes("v0=")) {
    const parts = trimmed.split(",").map((p) => p.trim());
    const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
    const v0 = parts.find((p) => p.startsWith("v0="))?.slice(3);
    if (timestamp && v0) {
      return { timestamp, hmacHex: v0 };
    }
  }

  // Legacy: v0=<timestamp>,<hmac_hex>
  if (trimmed.startsWith("v0=")) {
    const rest = trimmed.slice(3);
    const comma = rest.indexOf(",");
    if (comma > 0) {
      const timestamp = rest.slice(0, comma);
      const hmacHex = rest.slice(comma + 1);
      if (timestamp && hmacHex) {
        return { timestamp, hmacHex };
      }
    }
  }

  return null;
}
