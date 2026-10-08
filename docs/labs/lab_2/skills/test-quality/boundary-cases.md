---
name: boundary-cases
description: Flag tests for a changed comparison or range that skip the boundary values (exactly at, one below, one above the limit) and empty inputs.
type: rubric
---
# Boundary cases

When the diff adds or changes a comparison (`<`, `<=`, `>`, `>=`), a length/size check, pagination or a range, the tests must exercise the edges.

- Required values: the limit itself, limit − 1, limit + 1; plus `0`, empty string/array and `null`/`undefined` when the type allows them.
- An off-by-one (`<` vs `<=`) survives every test that only uses values far from the limit — say which edge is missing.
- WARNING by default; CRITICAL when the limit guards money, quotas or security.

## Good
```ts
it.each([[99, true], [100, true], [101, false]])('allows up to 100 items (%i)', (n, ok) => {
  expect(canAdd(n)).toBe(ok);
});
it('rejects an empty cart', () => expect(() => checkout([])).toThrow());
```

## Bad
```ts
it('allows small carts', () => expect(canAdd(3)).toBe(true)); // 100 vs 101 never checked
```
