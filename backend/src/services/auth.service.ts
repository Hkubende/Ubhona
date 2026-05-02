import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import type { UserRole } from "@prisma/client";

const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
if (!JWT_SECRET || JWT_SECRET === "dev-secret" || JWT_SECRET.length < 32) {
  throw new Error("Missing or weak JWT_SECRET. Set a strong secret (>=32 chars) before starting backend.");
}
const PASSWORD_RESET_SECRET = String(process.env.PASSWORD_RESET_SECRET || JWT_SECRET).trim();
const PASSWORD_RESET_TTL = "30m";
const PASSWORD_RESET_PURPOSE = "password_reset";
const RESET_MESSAGE = "If an account exists for that email, password reset instructions have been prepared.";

function signToken(user: { id: string; email: string; role: UserRole }) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function getPublicAppUrl() {
  const candidates = [
    process.env.FRONTEND_URL,
    process.env.PUBLIC_APP_URL,
    process.env.APP_PUBLIC_BASE_URL,
    process.env.QR_BASE_URL,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (candidates.length) {
    return candidates[0].replace(/\/+$/, "");
  }

  return "http://localhost:5173";
}

function shouldExposeResetUrl() {
  const env = String(process.env.NODE_ENV || "").trim().toLowerCase();
  return env !== "production";
}

function createPasswordResetToken(user: { id: string; email: string; passwordHash: string }) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      purpose: PASSWORD_RESET_PURPOSE,
      passwordHash: user.passwordHash,
    },
    PASSWORD_RESET_SECRET,
    { expiresIn: PASSWORD_RESET_TTL }
  );
}

export async function requestPasswordReset(input: { email: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return { message: RESET_MESSAGE };
  }

  const token = createPasswordResetToken(user);
  const resetUrl = `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    message: RESET_MESSAGE,
    resetUrl: shouldExposeResetUrl() ? resetUrl : undefined,
  };
}

export async function resetPassword(input: { token: string; password: string }) {
  let payload: jwt.JwtPayload;

  try {
    payload = jwt.verify(input.token, PASSWORD_RESET_SECRET) as jwt.JwtPayload;
  } catch {
    throw new Error("Invalid or expired password reset link.");
  }

  if (payload.purpose !== PASSWORD_RESET_PURPOSE) {
    throw new Error("Invalid or expired password reset link.");
  }

  const userId = String(payload.sub || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const passwordHash = String(payload.passwordHash || "").trim();

  if (!userId || !email || !passwordHash) {
    throw new Error("Invalid or expired password reset link.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== email) {
    throw new Error("Invalid or expired password reset link.");
  }

  if (user.passwordHash !== passwordHash) {
    throw new Error("This password reset link has already been used or has expired.");
  }

  const nextHash = await bcrypt.hash(input.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: nextHash },
  });

  return { message: "Password updated successfully. You can now sign in." };
}

export async function signup(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already registered.");
  const hash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: hash,
    },
  });
  return {
    token: signToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("No account found for this email.");
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new Error("Invalid password.");
  return {
    token: signToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
