"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "@/lib/gate";

/** Where the browser a capture runs in comes from. */
export type CaptureSource = "env" | "key";

export interface CaptureSourceState {
  /** null until the server has answered — nothing is asked of the user yet. */
  source: CaptureSource | null;
  /** This machine could take the capture itself, so the Local button is real. */
  localAvailable: boolean;
}

/**
 * Ask the server, once, what a capture would use.
 *
 * Only the server knows whether the deployment carries a Browserless token, and
 * only it can say whether the app is being used from the machine it runs on.
 * Both answers are about which controls to show — neither is a permission.
 */
export function useCaptureSource(): CaptureSourceState {
  const [state, setState] = useState<CaptureSourceState>({
    source: null,
    localAvailable: false,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/screenshot", {
          cache: "no-store",
          headers: await authHeaders(),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          source?: unknown;
          localAvailable?: unknown;
        };
        if (cancelled) return;
        setState({
          source: data.source === "env" ? "env" : "key",
          localAvailable: data.localAvailable === true,
        });
      } catch {
        // Offline or blocked: leave the workspace as it is. A capture that goes
        // out anyway gets the same answer from the POST.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
