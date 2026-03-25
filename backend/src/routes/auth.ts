import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rate-limit.js";
import type { AuthRequest } from "../types.js";
import { login, me, signup } from "../services/auth.service.js";

export const authRouter = Router();
const signupLimiter = createRateLimiter({
  keyPrefix: "auth-signup",
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: "Too many signup attempts. Please try again later.",
});
const loginLimiter = createRateLimiter({
  keyPrefix: "auth-login",
  windowMs: 10 * 60 * 1000,
  max: 12,
  message: "Too many login attempts. Please try again shortly.",
});

authRouter.post("/signup", signupLimiter, async (req, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
      })
      .parse(req.body);
    const response = await signup(body);
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Signup failed." });
  }
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body);
    const response = await login(body);
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Login failed." });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await me(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json(user);
});

