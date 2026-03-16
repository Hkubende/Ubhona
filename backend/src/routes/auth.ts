import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { login, me, signup } from "../services/auth.service.js";

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
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

authRouter.post("/login", async (req, res) => {
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

