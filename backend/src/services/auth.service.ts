import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import type { UserRole } from "@prisma/client";

const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
if (!JWT_SECRET || JWT_SECRET === "dev-secret" || JWT_SECRET.length < 32) {
  throw new Error("Missing or weak JWT_SECRET. Set a strong secret (>=32 chars) before starting backend.");
}

function signToken(user: { id: string; email: string; role: UserRole }) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
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
