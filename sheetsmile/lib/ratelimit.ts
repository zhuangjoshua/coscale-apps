/**
 * In-memory sliding-window rate limiter. Good enough for a single-process
 * deployment; swap for Redis/Upstash when running multiple instances.
 */
const buckets = new Map<string, number[]>();

const LIMITS = {
  perIpPerForm: { max: 10, windowMs: 60_000 }, // 10/min per IP per form
  perForm: { max: 300, windowMs: 3_600_000 }, // 300/hour per form
};

function hit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const times = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= max) {
    buckets.set(key, times);
    return false;
  }
  times.push(now);
  buckets.set(key, times);
  return true;
}

/** Returns true if the request is allowed. */
export function allowSubmission(formId: string, ip: string): boolean {
  return (
    hit(`form:${formId}`, LIMITS.perForm.max, LIMITS.perForm.windowMs) &&
    hit(
      `ip:${ip}:${formId}`,
      LIMITS.perIpPerForm.max,
      LIMITS.perIpPerForm.windowMs
    )
  );
}

// Periodically drop empty buckets so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of buckets) {
    const live = times.filter((t) => now - t < LIMITS.perForm.windowMs);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}, 600_000).unref?.();
