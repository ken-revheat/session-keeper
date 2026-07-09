"use client";
// React adapter over the framework-agnostic core (see ./core). Thin DOM
// wiring only — no state-machine logic lives here. Guards the
// visibilitychange listener so a refresh check only fires when the tab
// becomes visible again (core.onFocus is DOM-free and no longer checks
// document.visibilityState itself — see Task 2 context).
import { useEffect } from "react";
import { createSessionKeeper, readSessionExpiryMs, safeNextUrl } from "./core";
export function SessionKeeper(props) {
    const { apiBaseUrl, portalUrl } = props;
    useEffect(() => {
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
        return () => {
            k.stop();
            document.removeEventListener("visibilitychange", f);
            window.removeEventListener("focus", f);
        };
    }, [apiBaseUrl, portalUrl]);
    return null;
}
//# sourceMappingURL=react.js.map