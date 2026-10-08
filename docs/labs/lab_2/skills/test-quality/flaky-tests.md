---
name: flaky-tests
description: Flag tests that depend on real time, sleeps, randomness, test order or shared mutable state, so they can pass and fail on the same code.
type: rubric
---
# Flaky tests

- Finding: `setTimeout`/`sleep` waits, `Date.now()`/`new Date()` without a fake clock, `Math.random()` without a seed, network calls, or state shared between tests without reset.
- Finding: a test that passes only when run after another test.
- Suggest fake timers, an injected clock, a seeded generator, or a `beforeEach` reset. WARNING; CRITICAL when the test gates CI merges.

## Good
```ts
vi.useFakeTimers();
const p = retry(op);
await vi.advanceTimersByTimeAsync(3000);
await expect(p).resolves.toBe('ok');
```

## Bad
```ts
await new Promise((r) => setTimeout(r, 3000)); // slow, and flaky on a busy CI runner
expect(job.done).toBe(true);
```
