export declare function createSessionRefreshPlugin(opts: {
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
}): () => void;
//# sourceMappingURL=nuxt.d.ts.map