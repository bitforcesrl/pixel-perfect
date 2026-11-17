'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { detectExtension, type ExtensionInfo } from '@/lib/extension-bridge';

export interface CaptureExtensionState {
  /** The extension that answered, or null while none has. */
  extension: ExtensionInfo | null;
  /**
   * Ask again, now: what a capture calls before telling the user to install
   * the extension. The first probe may not have answered yet, or the
   * extension may have been installed since. Resolves with what answered.
   */
  recheck: () => Promise<ExtensionInfo | null>;
}

/**
 * The Pixel Perfect Capture extension, when this browser has it.
 *
 * Asked once on mount, and again whenever the tab comes back into view while
 * none was found: installing the extension happens in another tab, and the
 * workspace should notice without a reload. (An extension installed after a
 * page loaded only reaches pages loaded after it, so a reload may still be
 * needed; the install dialog says so.)
 */
export function useCaptureExtension(): CaptureExtensionState {
  const [extension, setExtension] = useState<ExtensionInfo | null>(null);
  // Read by the probes without re-subscribing the listeners on every change
  const foundRef = useRef(false);

  const recheck = useCallback(async () => {
    const info = await detectExtension();
    if (info) {
      foundRef.current = true;
      setExtension(info);
    }
    return info;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const probe = () => {
      if (foundRef.current) return;
      void detectExtension().then((info) => {
        if (cancelled || !info) return;
        foundRef.current = true;
        setExtension(info);
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') probe();
    };
    probe();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { extension, recheck };
}
