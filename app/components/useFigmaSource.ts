"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "@/lib/gate";

/** Where the token a Figma export runs with comes from. */
export type FigmaSource = "env" | "key";

/**
 * Ask the server, once, whether it carries a Figma token of its own. Null until
 * it answers; an export that goes out before then gets the same answer from
 * the POST.
 */
export function useFigmaSource(): FigmaSource | null {
  const [source, setSource] = useState<FigmaSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/figma", {
          cache: "no-store",
          headers: await authHeaders(),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { source?: unknown };
        if (!cancelled) setSource(data.source === "env" ? "env" : "key");
      } catch {
        // Offline or blocked: the POST reports the same thing later
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return source;
}
