import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../lib/auth";
import { hasRestaurantProfile, syncRestaurantProfile } from "../lib/restaurant";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.png`;

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
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
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
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="owner@restaurant.com"
              type="email"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Password</div>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="Password"
              type="password"
              required
            />
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-black transition hover:bg-emerald-300"
          >
            Login
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-white/65">
          No account yet?{" "}
          <Link className="font-bold text-orange-300 hover:text-orange-200" to="/signup">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
