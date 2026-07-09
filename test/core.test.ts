import { describe, it, expect, vi } from "vitest";
import { computeRefreshDelayMs, readSessionExpiryMs, safeNextUrl,
  createSessionKeeper, REFRESH_SKEW_MS, MIN_REFRESH_DELAY_MS,
  shouldBounceToNext } from "../src/core";

describe("computeRefreshDelayMs", () => {
  it("targets expiresAt - skew", () => {
    expect(computeRefreshDelayMs(1_000_000, 0, {skewMs: 60_000})).toBe(940_000);
  });
  it("floors an already-expired token to MIN", () => {
    expect(computeRefreshDelayMs(0, 1_000_000)).toBe(MIN_REFRESH_DELAY_MS);
  });
  it("caps a far-future expiry", () => {
    expect(computeRefreshDelayMs(1e15, 0)).toBe(86_400_000);
  });
});

describe("readSessionExpiryMs", () => {
  const enc = (o: unknown) => encodeURIComponent(JSON.stringify(o));
  it("reads expiry from a single-encoded cookie", () => {
    expect(readSessionExpiryMs(`x=1; revheat_session_info=${enc({expiresAt: 123})}`)).toBe(123);
  });
  it("returns null when absent/malformed", () => {
    expect(readSessionExpiryMs("x=1")).toBeNull();
    expect(readSessionExpiryMs("revheat_session_info=not-json")).toBeNull();
  });
  it("does not match a sibling cookie name prefix", () => {
    expect(readSessionExpiryMs(`revheat_session_info_x=${enc({expiresAt: 9})}`)).toBeNull();
  });
});

describe("safeNextUrl", () => {
  it("uses the host when it is .revheat.com", () => {
    expect(safeNextUrl("hire.revheat.com", "/app?x=1")).toBe("https://hire.revheat.com/app?x=1");
  });
  it("falls back off an off-domain host", () => {
    expect(safeNextUrl("evil.com", "/app")).toBe("https://app.revheat.com/app");
  });
});

describe("shouldBounceToNext", () => {
  it("bounces on 200 + valid https subdomain next", () => {
    expect(shouldBounceToNext(200, "https://hire.revheat.com/app?x=1")).toEqual({
      bounce: true,
      url: "https://hire.revheat.com/app?x=1",
    });
  });
  it("bounces on 200 + valid https apex next", () => {
    expect(shouldBounceToNext(200, "https://revheat.com/foo")).toEqual({
      bounce: true,
      url: "https://revheat.com/foo",
    });
  });
  it("does not bounce on non-200 status", () => {
    expect(shouldBounceToNext(401, "https://hire.revheat.com/app")).toEqual({ bounce: false });
  });
  it("does not bounce when next is null", () => {
    expect(shouldBounceToNext(200, null)).toEqual({ bounce: false });
  });
  it("does not bounce on an off-domain host", () => {
    expect(shouldBounceToNext(200, "https://evil.com/app")).toEqual({ bounce: false });
  });
  it("does not bounce on a non-https next", () => {
    expect(shouldBounceToNext(200, "http://hire.revheat.com/app")).toEqual({ bounce: false });
  });
  it("does not bounce on an unparseable next", () => {
    expect(shouldBounceToNext(200, "not-a-url")).toEqual({ bounce: false });
  });
  it("does not bounce on a suffix-spoofed host (evil.revheat.com.attacker.com)", () => {
    expect(shouldBounceToNext(200, "https://evil.revheat.com.attacker.com/x")).toEqual({
      bounce: false,
    });
  });
  it("does not bounce on a userinfo-spoofed host (revheat.com@evil.com)", () => {
    expect(shouldBounceToNext(200, "https://revheat.com@evil.com/x")).toEqual({ bounce: false });
  });
});

describe("createSessionKeeper", () => {
  it("refreshes and reschedules on 200; stops + onDead on 401", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    const onDead = vi.fn();
    let expiry: number | null = Date.now() + 1000; // within skew → immediate-ish
    const k = createSessionKeeper({ refreshUrl: "https://api.revheat.com/api/auth/refresh",
      readExpiryMs: () => expiry, fetchImpl, onDead });
    k.start();
    await vi.advanceTimersByTimeAsync(MIN_REFRESH_DELAY_MS + 10);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.revheat.com/api/auth/refresh",
      expect.objectContaining({ method: "POST", credentials: "include" }));
    expiry = Date.now() - 1; // now expired → next fire 401s
    await vi.advanceTimersByTimeAsync(MIN_REFRESH_DELAY_MS + 10);
    expect(onDead).toHaveBeenCalledOnce();
    k.stop();
    vi.useRealTimers();
  });

  it("stays idle when readExpiryMs returns null: no fetch, no onDead", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn();
    const onDead = vi.fn();
    const k = createSessionKeeper({
      refreshUrl: "https://api.revheat.com/api/auth/refresh",
      readExpiryMs: () => null,
      fetchImpl,
      onDead,
    });
    k.start();
    await vi.advanceTimersByTimeAsync(MIN_REFRESH_DELAY_MS + 10);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onDead).not.toHaveBeenCalled();
    k.onFocus();
    await vi.advanceTimersByTimeAsync(MIN_REFRESH_DELAY_MS + 10);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onDead).not.toHaveBeenCalled();
    k.stop();
    vi.useRealTimers();
  });
});
