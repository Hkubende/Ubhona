import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupUser } from "../lib/auth";
import { trackLaunchFunnelEvent } from "../lib/analytics";
import { hasRestaurantProfile, syncRestaurantProfile } from "../lib/restaurant";
import { getDefaultRouteForRole, getPrimaryDashboardRole } from "../lib/roles";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const signupStartTrackedRef = React.useRef(false);

  const markSignupStart = () => {
    if (signupStartTrackedRef.current) return;
    signupStartTrackedRef.current = true;
    void trackLaunchFunnelEvent("signup_start", {
      page: "signup",
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const result = await signupUser(name, email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    void trackLaunchFunnelEvent("signup_complete", {
      page: "signup",
      hasName: Boolean(name.trim()),
      emailDomain: email.includes("@") ? email.split("@")[1] : "",
    });
    if (result.user.role === "platform_admin") {
      navigate("/admin");
      return;
    }
    await syncRestaurantProfile();
    if (!hasRestaurantProfile()) {
      navigate("/onboarding");
      return;
    }
    navigate(getDefaultRouteForRole(getPrimaryDashboardRole(result.user)));
  };

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 text-text-primary">
      <Card className="mx-auto max-w-md p-6 backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-[color:var(--ui-note-icon-bg)] p-1.5">
          <Link
            to="/login"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[14px] px-4 text-sm font-medium text-text-secondary/75 transition-colors duration-200 hover:text-text-primary"
          >
            Sign in
          </Link>
          <div className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[14px] border border-primary/20 bg-primary/12 px-4 text-sm font-semibold text-text-primary">
            Get started
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <img src={LOGO_SRC} alt="Ubhona" className="h-10 w-10 rounded-2xl object-cover" />
          <div>
            <div className="text-xl font-black"><span className="text-primary">Ubhona</span> Sign up</div>
            <div className="text-xs text-text-secondary/68">Create your restaurant account</div>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="signup-name" className="mb-1 block text-xs text-text-secondary/68">
              Name
            </label>
            <Input
              id="signup-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={markSignupStart}
              placeholder="Owner name"
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="mb-1 block text-xs text-text-secondary/68">
              Email
            </label>
            <Input
              id="signup-email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onFocus={markSignupStart}
              placeholder="owner@restaurant.com"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="mb-1 block text-xs text-text-secondary/68">
              Password
            </label>
            <Input
              id="signup-password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={markSignupStart}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-confirm-password" className="mb-1 block text-xs text-text-secondary/68">
              Confirm Password
            </label>
            <Input
              id="signup-confirm-password"
              name="confirmPassword"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              onFocus={markSignupStart}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Create Account
          </Button>
          <div className="text-center text-xs leading-6 text-text-secondary/68">
            By creating an account, you agree to the{" "}
            <Link className="font-semibold text-primary transition-colors hover:text-primary/80" to="/terms">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link className="font-semibold text-primary transition-colors hover:text-primary/80" to="/privacy">
              Privacy Policy
            </Link>
            .
          </div>
        </form>

        <div className="mt-4 text-center text-sm text-text-secondary/72">
          Already have an account?{" "}
          <Link className="font-bold text-primary transition-colors hover:text-primary/80" to="/login">
            Sign in
          </Link>
        </div>
      </Card>
    </main>
  );
}
