"use client";

import { useEffect, useState } from "react";
import RegistrationMark from "./RegistrationMark";
import {
  checkPassword,
  forgetPassword,
  isGateRequired,
  readPassword,
  rememberPassword,
} from "@/lib/gate";

/**
 * Holds the app back until this browser has the site password in IndexedDB.
 *
 * Stored password still there and still right → the app renders and nothing is
 * asked. Never entered, or no longer accepted → the form. A deployment with no
 * `SITE_PASSWORD` set (local, by default) opens straight through.
 */
type Phase = "checking" | "locked" | "open";

export default function PasswordGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (!(await isGateRequired())) {
          if (!cancelled) setPhase("open");
          return;
        }
        const stored = await readPassword();
        // A stored password the server no longer accepts is worse than none:
        // drop it so the form is the only thing left.
        if (stored && (await checkPassword(stored))) {
          if (!cancelled) setPhase("open");
          return;
        }
        if (stored) await forgetPassword();
      } catch {
        // Offline, or the check itself failed — stay closed and let the visitor
        // try, rather than opening on an error.
      }
      if (!cancelled) setPhase("locked");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (!(await checkPassword(password))) {
        setError("Wrong password.");
        return;
      }
      await rememberPassword(password);
      setPassword("");
      setPhase("open");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (phase === "open") return <>{children}</>;

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 overflow-y-auto bg-ink-void p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <RegistrationMark size={44} className="text-ink-600" />
        <h1 className="font-display text-[15px] font-extrabold tracking-[0.16em] text-ink-100 uppercase">
          Pixel Perfect
        </h1>
        <p className="text-xs text-ink-500">
          {phase === "checking" ? "Checking…" : "This site is password protected."}
        </p>
      </div>

      {phase === "locked" ? (
        <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
              Password
            </span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              aria-invalid={error ? true : undefined}
              placeholder="••••••••"
              className="rounded border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-press-violet aria-invalid:border-press-red/70"
            />
          </label>
          {error ? (
            <p role="alert" className="text-xs text-press-red">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-press-violet px-3 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-press-violet/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Checking…" : "Enter"}
          </button>
        </form>
      ) : null}
    </main>
  );
}
