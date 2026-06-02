import { describe, it, expect, vi, afterEach } from "vitest";
import { withTimeout, TimeoutError } from "../lib/util/timeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves with the value when the promise settles in time", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, "fast");
    expect(result).toBe(42);
  });

  it("propagates the original rejection (not a TimeoutError) when it rejects first", async () => {
    const boom = new Error("boom");
    await expect(withTimeout(Promise.reject(boom), 1000, "rejects")).rejects.toBe(boom);
  });

  it("rejects with TimeoutError when the deadline fires first", async () => {
    vi.useFakeTimers();
    const never = new Promise<number>(() => {
      /* never settles */
    });
    const p = withTimeout(never, 500, "slow");
    const assertion = expect(p).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it("TimeoutError carries label and timeoutMs", async () => {
    vi.useFakeTimers();
    const never = new Promise<number>(() => undefined);
    const p = withTimeout(never, 250, "db.query");
    const assertion = p.catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(250);
    const err = (await assertion) as TimeoutError;
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.label).toBe("db.query");
    expect(err.timeoutMs).toBe(250);
  });

  it("clears the timer so a fast resolve doesn't leak a pending timeout", async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, "clearTimeout");
    await withTimeout(Promise.resolve("ok"), 1000, "fast");
    expect(clearSpy).toHaveBeenCalled();
  });
});
