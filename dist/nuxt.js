// Nuxt adapter over the framework-agnostic core (see ./core). Plain factory,
// NO vue/#app/defineNuxtPlugin import — the Nuxt caller wraps the returned
// function in defineNuxtPlugin from a `.client` plugin (see Task 5). Keeping
// this module framework-import-free means the build needs no Vue
// devDependency. Reads document.cookie / location / window directly; the
// caller guarantees this only ever runs client-side.
import { createSessionKeeper, readSessionExpiryMs, safeNextUrl } from "./core";
export function createSessionRefreshPlugin(opts) {
    const { apiBaseUrl, portalUrl } = opts;
    return () => {
        const readExpiryMs = () => readSessionExpiryMs(document.cookie);
        const refreshUrl = `${apiBaseUrl.replace(/\/$/, "")}/api/auth/refresh`;
        const onDead = () => {
            const next = safeNextUrl(location.host, location.pathname + location.search);
            location.href = `${portalUrl}/login?next=` + encodeURIComponent(next);
        };
        const k = createSessionKeeper({ refreshUrl, readExpiryMs, onDead });
        k.start();
        const f = () => {
            if (document.visibilityState === "hidden")
                return;
            k.onFocus();
        };
        document.addEventListener("visibilitychange", f);
        window.addEventListener("focus", f);
    };
}
//# sourceMappingURL=nuxt.js.map