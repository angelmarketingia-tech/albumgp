// Timeout primitive for hot-path I/O (Redis, DB, outbound fetch).
//
// WHY: under heavy traffic a managed service (Upstash, Neon) can slow down or
// stall. Without a deadline the awaiting promise never settles, the serverless
// invocation hangs until the platform kills it, and any UI spinner driven by
// the request (e.g. "Canjeando…") spins forever. Wrapping the I/O in a race
// against a timer guarantees the path either completes or fails fast.
//
// SERVER ONLY. Pure (no platform deps) so it's unit-testable with fake timers.

/** Thrown by `withTimeout` when the wrapped promise doesn't settle in time. */
export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly label: string;
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Race `promise` against a `timeoutMs` deadline.
 *
 * Resolves with the promise's value if it settles first; rejects with
 * `TimeoutError` if the timer fires first. The timer is always cleared so a
 * fast-resolving promise doesn't leak a pending timeout that keeps the event
 * loop (or a serverless invocation) alive.
 *
 * Note: this does NOT cancel the underlying work — JS promises aren't
 * cancellable. For fetch, pair this with an AbortController. For Redis/Prisma
 * the dangling query is harmless: it completes (or errors) in the background
 * and its result is ignored. The point is to stop *awaiting* it.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(label, timeoutMs));
    }, timeoutMs);
    // Don't keep the process alive solely for this timer (Node).
    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      (timer as { unref: () => void }).unref();
    }
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}
