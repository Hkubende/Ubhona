import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEMO_EMAIL, DEMO_PASSWORD, googleSignIn, loginUser, type AuthUser } from "../lib/auth";
import { hasRestaurantProfile, syncRestaurantProfile } from "../lib/restaurant";
import { getDefaultRouteForRole, getPrimaryDashboardRole } from "../lib/roles";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  const routeAfterAuth = async (user: AuthUser) => {
    if (user.role === "platform_admin") {
      navigate("/admin");
      return;
    }
    await syncRestaurantProfile();
    if (!hasRestaurantProfile()) {
      navigate("/onboarding");
      return;
    }
    navigate(getDefaultRouteForRole(getPrimaryDashboardRole(user)));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const result = await loginUser(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await routeAfterAuth(result.user);
  };

  const onGoogleCredential = async (credential: string) => {
    setError("");
    const result = await googleSignIn(credential);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await routeAfterAuth(result.user);
  };

  const loginAsDemo = async () => {
    setError("");
    const result = await loginUser(DEMO_EMAIL, DEMO_PASSWORD);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await syncRestaurantProfile();
    navigate(getDefaultRouteForRole(getPrimaryDashboardRole(result.user)));
  };

  return (
    <div className="min-h-screen bg-app-bg px-4 py-8 text-text-primary">
      <Card className="mx-auto max-w-md p-6 backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-[color:var(--ui-note-icon-bg)] p-1.5">
          <div className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[14px] border border-primary/20 bg-primary/12 px-4 text-sm font-semibold text-text-primary">
            Sign in
          </div>
          <Link
            to="/signup"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[14px] px-4 text-sm font-medium text-text-secondary/75 transition-colors duration-200 hover:text-text-primary"
          >
            Get started
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <img src={LOGO_SRC} alt="Ubhona" className="h-10 w-10 rounded-2xl object-cover" />
          <div>
            <div className="text-xl font-black"><span className="text-primary">Ubhona</span> Sign in</div>
            <div className="text-xs text-text-secondary/68">Restaurant access</div>
          </div>
        </div>

        <div className="mb-4">
          <GoogleSignInButton label="signin_with" onCredential={onGoogleCredential} onError={setError} />
        </div>

        <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-text-secondary/50">
          <span className="h-px flex-1 bg-border" />
          <span>Email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <div className="mb-1 text-xs text-text-secondary/68">Email</div>
            <Input
              id="login-email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@restaurant.com"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-text-secondary/68">Password</div>
            <Input
              id="login-password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="text-right text-xs">
            <Link className="font-semibold text-primary transition-colors hover:text-primary/80" to="/reset-password">
              Forgot password?
            </Link>
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <Button type="submit" variant="success" size="lg" className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-text-primary">
          <div className="font-semibold text-primary">Demo account</div>
          <div>Email: {DEMO_EMAIL}</div>
          <div>Password: {DEMO_PASSWORD}</div>
          <Button
            type="button"
            onClick={() => void loginAsDemo()}
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
          >
            Enter Demo Mode
          </Button>
        </div>

        <div className="mt-4 text-center text-sm text-text-secondary/72">
          No account yet?{" "}
          <Link className="font-bold text-primary transition-colors hover:text-primary/80" to="/signup">
            Get started
          </Link>
        </div>
      </Card>
    </div>
  );
}
