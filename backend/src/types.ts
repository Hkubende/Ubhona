import type { Request } from "express";
import type { UserRole } from "@prisma/client";

export type AuthRequest = Request & {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
};
