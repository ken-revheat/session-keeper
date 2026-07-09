// Nuxt adapter over the framework-agnostic core (see ./core). Plain factory,
// NO vue/#app/defineNuxtPlugin import — the Nuxt caller wraps the returned
// function in defineNuxtPlugin from a `.client` plugin (see Task 5). Keeping
// this module framework-import-free means the build needs no Vue
// devDependency. Reads document.cookie / location / window directly; the
// caller guarantees this only ever runs client-side.

import { createSessionKeeper, readSessionExpiryMs, safeNextUrl } from "./core.js";

export function createSessionRefreshPlugin(opts: {
  apiBaseUrl: string;
  portalUrl: string;
  /**
   * On a dead refresh (401), redirect to `${portalUrl}/login?next=…`. Default
   * true. Pass false for a globally-mounted plugin on a host that already has
   * its own login gate (e.g. the portal's `auth.global.ts` middleware): the
   * keeper then just stops on 401 (matching the pre-package #77 behavior),
   * avoiding a redirect loop when the plugin runs on the login/auth pages
   * themselves. UX-only; the server-side gate is always authoritative.
   */
  redirectOnDead?: boolean;
}): () => void {
  const { apiBaseUrl, portalUrl, redirectOnDead = true } = opts;

  return () => {
    const readExpiryMs = () => readSessionExpiryMs(document.cookie);
    const refreshUrl = `${apiBaseUrl.replace(/\/$/, "")}/api/auth/refresh`;
    const onDead = redirectOnDead
      ? () => {
          const next = safeNextUrl(location.host, location.pathname + location.search);
          location.href = `${portalUrl}/login?next=` + encodeURIComponent(next);
        }
      : undefined;

    const k = createSessionKeeper({ refreshUrl, readExpiryMs, onDead });
    k.start();

    const f = () => {
      if (document.visibilityState === "hidden") return;
      k.onFocus();
    };
    document.addEventListener("visibilitychange", f);
    window.addEventListener("focus", f);
  };
}
