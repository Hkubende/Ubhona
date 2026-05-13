import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
  googleVerifyIdToken: vi.fn(),
}));

vi.mock("../prisma.js", () => ({
  prisma: mocks.prisma,
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(function OAuth2Client() {
    return {
    verifyIdToken: mocks.googleVerifyIdToken,
    };
  }),
}));

import { googleLogin, requestPasswordReset, resetPassword } from "../services/auth.service.js";

describe("auth.service password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FRONTEND_URL = "https://app.ubhona.test";
    process.env.GOOGLE_CLIENT_ID = "google-client-id.apps.googleusercontent.com";
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

  it("creates a user and app JWT from a verified Google ID token", async () => {
    mocks.googleVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-sub-1",
        email: "Owner@Ubhona.com",
        email_verified: true,
        name: "Google Owner",
      }),
    });
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.create.mockResolvedValue({
      id: "user-google-1",
      name: "Google Owner",
      email: "owner@ubhona.com",
      role: "restaurant_owner",
      createdAt: new Date("2026-05-05T00:00:00.000Z"),
    });

    const response = await googleLogin({ credential: "google-id-token" });

    expect(mocks.googleVerifyIdToken).toHaveBeenCalledWith({
      idToken: "google-id-token",
      audience: "google-client-id.apps.googleusercontent.com",
    });
    expect(mocks.prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: "Google Owner",
        email: "owner@ubhona.com",
        passwordHash: "oauth:google:google-sub-1",
      },
    });
    expect(response.token).toBeTruthy();
    expect(response.user.email).toBe("owner@ubhona.com");
  });

  it("reuses an existing user for a verified Google ID token", async () => {
    const existingUser = {
      id: "user-existing",
      name: "Existing Owner",
      email: "existing@ubhona.com",
      role: "restaurant_owner",
      createdAt: new Date("2026-05-05T00:00:00.000Z"),
    };
    mocks.googleVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-sub-existing",
        email: existingUser.email,
        email_verified: true,
        name: "Google Owner",
      }),
    });
    mocks.prisma.user.findUnique.mockResolvedValue(existingUser);

    const response = await googleLogin({ credential: "google-id-token" });

    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
    expect(response.user.id).toBe(existingUser.id);
  });

  it("rejects Google tokens without a verified email", async () => {
    mocks.googleVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-sub-1",
        email: "owner@ubhona.com",
        email_verified: false,
        name: "Google Owner",
      }),
    });

    await expect(googleLogin({ credential: "google-id-token" })).rejects.toThrow(
      "Google account email could not be verified."
    );
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });
});
