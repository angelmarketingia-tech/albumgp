"use client";

// Client-side redundancy for the /ir bridge page. The <meta http-equiv=refresh>
// in the server component is the primary trigger (works with no JS, CSP-safe).
// This component adds two things on top, WITHOUT inline scripts (prod CSP is
// `script-src 'self'`, so this lives in an external module that 'self' allows):
//
//   1. `location.replace(url)` on mount — fires immediately in parallel with
//      the meta-refresh; whichever the browser/WebView honors first wins.
//   2. A "stuck" affordance: if we're still on this page after ~2.5s (target
//      slow, popup blocked, WebView quirk), surface a loud manual button so the
//      user is never staring at a frozen "te estamos llevando…".
//
// Net effect: the redirect never *looks* hung. Either it navigates, or the user
// gets an obvious tap target within a couple seconds.

import { useEffect, useState } from "react";

export function ExternalRedirect({ url }: { url: string }) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    // Fire the navigation right away. replace() so back-button doesn't return
    // here and re-loop.
    try {
      window.location.replace(url);
    } catch {
      // Some WebViews throw on replace() in odd states — fall through to the
      // manual affordance below.
    }

    // If navigation didn't tear this component down quickly, show the fallback.
    const t = setTimeout(() => setStuck(true), 2500);
    return () => clearTimeout(t);
  }, [url]);

  if (!stuck) return null;

  return (
    <a
      href={url}
      className="inline-flex h-12 min-h-12 items-center justify-center rounded-md bg-gp-gold px-6 font-sans text-base font-black uppercase tracking-wide text-gp-green-deep shadow-md animate-pulse"
    >
      Tocá aquí para continuar →
    </a>
  );
}
