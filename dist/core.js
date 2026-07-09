// Framework-agnostic session-keeper core: pure timing/parsing helpers plus the
// refresh state machine. No DOM, no direct fetch/cookie reads — those are
// injected via SessionKeeperDeps so this module stays testable and portable
// across React/Nuxt adapters (see Task 2).
export const REFRESH_SKEW_MS = 60000;
export const MIN_REFRESH_DELAY_MS = 5000;
export const MAX_REFRESH_DELAY_MS = 24 * 60 * 60 * 1000; // 86_400_000
export const REFRESH_RETRY_DELAY_MS = 30000;
export function computeRefreshDelayMs(expiresAtMs, nowMs, opts) {
    const skewMs = opts?.skewMs ?? REFRESH_SKEW_MS;
    const minDelayMs = opts?.minDelayMs ?? MIN_REFRESH_DELAY_MS;
    const maxDelayMs = opts?.maxDelayMs ?? MAX_REFRESH_DELAY_MS;
    const target = expiresAtMs - skewMs - nowMs;
    return Math.min(Math.max(target, minDelayMs), maxDelayMs);
}
// cookieName defaults to "revheat_session_info". Returns expiresAt (epoch ms)
// even if already past; returns null only when the cookie is ABSENT or
// malformed. Must NOT match a sibling prefix (e.g. "revheat_session_info_x"):
// split on "; " and require an EXACT "<name>=" prefix on a whole entry.
export function readSessionExpiryMs(cookieString, cookieName = "revheat_session_info") {
    const prefix = `${cookieName}=`;
    const entry = cookieString.split("; ").find((c) => c.startsWith(prefix));
    if (!entry)
        return null;
    const raw = entry.slice(prefix.length);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        try {
            parsed = JSON.parse(decodeURIComponent(raw));
        }
        catch {
            return null;
        }
    }
    if (!parsed || typeof parsed !== "object")
        return null;
    const exp = parsed.expiresAt;
    return typeof exp === "number" ? exp : null;
}
// Package default fallback host is the portal (app.revheat.com) — NOT any
// individual product's self-host. See Task 1 locked decision 2.
const FALLBACK_HOST = "app.revheat.com";
export function safeNextUrl(host, pathAndQuery) {
    const isRevheatHost = !!host && (host === "revheat.com" || host.endsWith(".revheat.com"));
    const safeHost = isRevheatHost ? host : FALLBACK_HOST;
    return `https://${safeHost}${pathAndQuery}`;
}
export function createSessionKeeper(deps) {
    const { refreshUrl, readExpiryMs, onDead } = deps;
    const now = deps.now ?? Date.now;
    const fetchImpl = deps.fetchImpl ?? fetch;
    let timer;
    let stopped = false;
    let refreshing = false;
    let backoffUntil = 0;
    let deadFired = false;
    const clearTimer = () => {
        if (timer)
            clearTimeout(timer);
        timer = undefined;
    };
    const onDeadOnce = () => {
        if (deadFired)
            return;
        deadFired = true;
        onDead?.();
    };
    const schedule = () => {
        clearTimer();
        if (stopped)
            return;
        const expiresAt = readExpiryMs();
        // LOCKED DECISION 1: cookie absent/malformed (null) => stay idle. Do not
        // schedule, fetch, or call onDead. An expired-but-PRESENT cookie still
        // returns a (past) number here, which computeRefreshDelayMs floors to
        // MIN_REFRESH_DELAY_MS below — only a genuinely absent cookie yields null.
        if (expiresAt === null)
            return;
        timer = setTimeout(refresh, computeRefreshDelayMs(expiresAt, now()));
    };
    const refresh = async () => {
        if (stopped || refreshing)
            return;
        refreshing = true;
        try {
            const res = await fetchImpl(refreshUrl, { method: "POST", credentials: "include" });
            refreshing = false;
            if (res.ok) {
                backoffUntil = 0;
                schedule();
                return;
            }
            if (res.status === 401) {
                stop();
                onDeadOnce();
                return;
            }
            backoffUntil = now() + REFRESH_RETRY_DELAY_MS;
            clearTimer();
            timer = setTimeout(refresh, REFRESH_RETRY_DELAY_MS);
        }
        catch {
            refreshing = false;
            backoffUntil = now() + REFRESH_RETRY_DELAY_MS;
            clearTimer();
            timer = setTimeout(refresh, REFRESH_RETRY_DELAY_MS);
        }
    };
    const start = () => {
        stopped = false;
        schedule();
    };
    const stop = () => {
        stopped = true;
        clearTimer();
    };
    const onFocus = () => {
        if (stopped)
            return;
        if (now() < backoffUntil)
            return;
        const expiresAt = readExpiryMs();
        // LOCKED DECISION 1: null => idle.
        if (expiresAt === null)
            return;
        if (expiresAt - now() < REFRESH_SKEW_MS)
            refresh();
        else
            schedule();
    };
    return { start, stop, onFocus };
}
//# sourceMappingURL=core.js.map