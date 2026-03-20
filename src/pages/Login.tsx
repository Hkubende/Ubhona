import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEMO_EMAIL, DEMO_PASSWORD, loginUser } from "../lib/auth";
import { hasRestaurantProfile, syncRestaurantProfile } from "../lib/restaurant";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const result = await loginUser(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.user.role === "platform_admin") {
      navigate("/admin");
      return;
    }
    await syncRestaurantProfile();
    navigate(hasRestaurantProfile() ? "/dashboard" : "/onboarding");
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] px-4 py-8 text-white">
      <Card className="mx-auto max-w-md p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={LOGO_SRC} alt="Ubhona" className="h-10 w-10 rounded-2xl object-cover" />
          <div>
            <div className="text-xl font-black"><span className="text-orange-400">Ubhona</span> Login</div>
            <div className="text-xs text-white/60">Restaurant access</div>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <div className="mb-1 text-xs text-white/60">Email</div>
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
            <div className="mb-1 text-xs text-white/60">Password</div>
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
          {error ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}
          <Button type="submit" variant="success" size="lg" className="w-full">
            Login
          </Button>
        </form>

        <div className="mt-4 rounded-2xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-100">
          <div className="font-semibold text-orange-200">Demo account</div>
          <div>Email: {DEMO_EMAIL}</div>
          <div>Password: {DEMO_PASSWORD}</div>
        </div>

        <div className="mt-4 text-center text-sm text-white/65">
          No account yet?{" "}
          <Link className="font-bold text-orange-300 hover:text-orange-200" to="/signup">
            Create one
          </Link>
        </div>
      </Card>
    </div>
  );
}
