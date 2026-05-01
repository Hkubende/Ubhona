import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { requestPasswordReset, resetPasswordWithToken } from "../lib/auth";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const isResetMode = Boolean(token);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [resetUrl, setResetUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const onRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setResetUrl("");
    const result = await requestPasswordReset(email);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    setNotice(result.message);
    setResetUrl(result.resetUrl || "");
    setBusy(false);
  };

  const onResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    if (password.length < 6) {
      setBusy(false);
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setBusy(false);
      setError("Passwords do not match.");
      return;
    }

    const result = await resetPasswordWithToken(token, password);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    setNotice(result.message);
    setBusy(false);
    window.setTimeout(() => navigate("/login"), 900);
  };

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 text-text-primary">
      <Card className="mx-auto max-w-md p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={LOGO_SRC} alt="Ubhona" className="h-10 w-10 rounded-2xl object-cover" />
          <div>
            <div className="text-xl font-black">
              <span className="text-primary">Ubhona</span> {isResetMode ? "Reset password" : "Recover account"}
            </div>
            <div className="text-xs text-text-secondary/68">
              {isResetMode ? "Choose a new password" : "Request password reset instructions"}
            </div>
          </div>
        </div>

        <form className="space-y-4" onSubmit={isResetMode ? onResetPassword : onRequestReset}>
          {isResetMode ? (
            <>
              <div>
                <label htmlFor="reset-password" className="mb-1 block text-xs text-text-secondary/68">
                  New Password
                </label>
                <Input
                  id="reset-password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="mb-1 block text-xs text-text-secondary/68">
                  Confirm Password
                </label>
                <Input
                  id="reset-confirm-password"
                  name="confirmPassword"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="recover-email" className="mb-1 block text-xs text-text-secondary/68">
                Email
              </label>
              <Input
                id="recover-email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@restaurant.com"
                type="email"
                autoComplete="email"
                required
              />
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
              {notice}
            </div>
          ) : null}
          {resetUrl ? (
            <div className="rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-text-primary break-all">
              Reset link:{" "}
              <a className="font-semibold text-primary transition-colors hover:text-primary/80" href={resetUrl}>
                {resetUrl}
              </a>
            </div>
          ) : null}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait..." : isResetMode ? "Update Password" : "Send Reset Instructions"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-text-secondary/72">
          Back to{" "}
          <Link className="font-bold text-primary transition-colors hover:text-primary/80" to="/login">
            Sign in
          </Link>
        </div>
      </Card>
    </main>
  );
}
