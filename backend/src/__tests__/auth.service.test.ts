import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("../prisma.js", () => ({
  prisma: mocks.prisma,
}));

import { requestPasswordReset, resetPassword } from "../services/auth.service.js";

describe("auth.service password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FRONTEND_URL = "https://app.ubhona.test";
  });

  it("returns a generic response when the account does not exist", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);

    const response = await requestPasswordReset({ email: "missing@ubhona.com" });

    expect(response.message).toContain("If an account exists");
    expect(response.resetUrl).toBeUndefined();
  });

  it("returns a reset URL for non-production environments when the account exists", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@ubhona.com",
      passwordHash: "hash-1",
    });

    const response = await requestPasswordReset({ email: "owner@ubhona.com" });

    expect(response.message).toContain("If an account exists");
    expect(response.resetUrl).toContain("https://app.ubhona.test/reset-password?token=");
  });

  it("updates the password when the reset token is valid", async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "owner@ubhona.com",
      passwordHash: "hash-1",
    });

    const request = await requestPasswordReset({ email: "owner@ubhona.com" });
    const resetUrl = request.resetUrl || "";
    const token = new URL(resetUrl).searchParams.get("token") || "";

    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "owner@ubhona.com",
      passwordHash: "hash-1",
    });
    mocks.prisma.user.update.mockResolvedValue({
      id: "user-1",
    });

    const response = await resetPassword({ token, password: "new-password-123" });

    expect(response.message).toContain("Password updated successfully");
    expect(mocks.prisma.user.update).toHaveBeenCalledOnce();
  });

  it("rejects reused tokens after the password hash has changed", async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "owner@ubhona.com",
      passwordHash: "hash-1",
    });

    const request = await requestPasswordReset({ email: "owner@ubhona.com" });
    const token = new URL(request.resetUrl || "").searchParams.get("token") || "";

    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "owner@ubhona.com",
      passwordHash: "hash-2",
    });

    await expect(resetPassword({ token, password: "new-password-123" })).rejects.toThrow(
      "This password reset link has already been used or has expired."
    );
  });
});
