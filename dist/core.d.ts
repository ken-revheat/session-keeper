export declare const REFRESH_SKEW_MS = 60000;
export declare const MIN_REFRESH_DELAY_MS = 5000;
export declare const MAX_REFRESH_DELAY_MS: number;
export declare const REFRESH_RETRY_DELAY_MS = 30000;
export declare function computeRefreshDelayMs(expiresAtMs: number, nowMs: number, opts?: {
    skewMs?: number;
    minDelayMs?: number;
    maxDelayMs?: number;
}): number;
export declare function readSessionExpiryMs(cookieString: string, cookieName?: string): number | null;
export declare function safeNextUrl(host: string | null, pathAndQuery: string): string;
/**
 * Decide whether the portal login page should silently bounce back to `next`
 * after attempting POST /api/auth/refresh.
 * - status: the HTTP status of the refresh response (200 = refresh cookie still valid).
 * - next: the raw `next` query param (a full absolute URL, or null/empty).
 * Bounce only on 200 AND a valid https `.revheat.com` absolute URL (loop/open-redirect guard).
 * The returned url is built via safeNextUrl (host + path+query), so an off-domain
 * host is rejected before we ever return bounce:true.
 */
export declare function shouldBounceToNext(status: number, next: string | null): {
    bounce: boolean;
    url?: string;
};
export interface SessionKeeperDeps {
    refreshUrl: string;
    readExpiryMs: () => number | null;
    now?: () => number;
    fetchImpl?: typeof fetch;
    onDead?: () => void;
}
export interface SessionKeeper {
    start(): void;
    stop(): void;
    onFocus(): void;
}
export declare function createSessionKeeper(deps: SessionKeeperDeps): SessionKeeper;
//# sourceMappingURL=core.d.ts.map