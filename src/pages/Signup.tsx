import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupUser } from "../lib/auth";
import { hasRestaurantProfile, syncRestaurantProfile } from "../lib/restaurant";
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
            <div className="text-xl font-black"><span className="text-orange-400">Ubhona</span> Signup</div>
            <div className="text-xs text-white/60">Create restaurant owner account</div>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <div className="mb-1 text-xs text-white/60">Name</div>
            <Input
              id="signup-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Owner name"
              autoComplete="name"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Email</div>
            <Input
              id="signup-email"
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
              id="signup-password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Confirm Password</div>
            <Input
              id="signup-confirm-password"
              name="confirmPassword"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Create Account
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-white/65">
          Already have an account?{" "}
          <Link className="font-bold text-emerald-300 hover:text-emerald-200" to="/login">
            Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
