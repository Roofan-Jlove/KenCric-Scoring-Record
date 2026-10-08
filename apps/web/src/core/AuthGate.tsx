import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

// Real auth, backed by the actual local Supabase GoTrue service -- not one
// of the 25 numbered UX screens (no login/signup screen exists anywhere in
// implementation-task-backlog.md's own UX-04..28 decomposition; every one
// of those screens assumes an already-authenticated session). This is the
// minimal real plumbing every other real-data screen depends on.

interface AuthGateProps {
  children: (session: Session) => JSX.Element;
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (session === "loading") {
    return <p style={{ padding: 24 }}>Loading session...</p>;
  }

  if (session === null) {
    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setError(null);
      setBusy(true);
      const result =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (result.error) setError(result.error.message);
    }

    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
        <form onSubmit={handleSubmit} style={{ width: 320, border: "1px solid #ccc", borderRadius: 8, padding: 24 }}>
          <h1 style={{ fontSize: 18, marginTop: 0 }}>KenCric — real backend</h1>
          <p style={{ fontSize: 12, color: "#666" }}>
            Signed in against the real local Supabase stack (GoTrue). {mode === "sign-up" ? "New account" : "Existing account"}.
          </p>
          <label style={{ display: "block", marginBottom: 8 }}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ display: "block", width: "100%", padding: 6, marginTop: 4 }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ display: "block", width: "100%", padding: 6, marginTop: 4 }}
            />
          </label>
          {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ width: "100%", padding: 8, marginBottom: 8 }}>
            {busy ? "Working..." : mode === "sign-in" ? "Sign in" : "Sign up"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            style={{ width: "100%", padding: 8, background: "none", border: "1px solid #ccc", cursor: "pointer" }}
          >
            {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return children(session);
}
