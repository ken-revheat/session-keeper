export declare function SessionKeeper(props: {
    apiBaseUrl: string;
    portalUrl: string;
    /**
     * On a dead refresh (401), redirect to `${portalUrl}/login?next=…`. Default
     * true. Pass false when the host already has its own login gate and you only
     * want the keeper to slide/stop (see the Nuxt adapter for the rationale).
     */
    redirectOnDead?: boolean;
}): null;
//# sourceMappingURL=react.d.ts.map