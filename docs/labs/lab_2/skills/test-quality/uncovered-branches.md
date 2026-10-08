---
name: uncovered-branches
description: Flag changed conditionals (if/else, switch, early return, catch) whose new or modified branch no test reaches.
type: rubric
---
# Uncovered branches

For every conditional the diff adds or changes, find a test that drives execution into each branch. A branch no test reaches is a finding.

- WARNING when the untested branch is an error or guard path; CRITICAL when it handles money, auth or deletion.
- Cite the line of the untested branch and name the test file that should cover it.
- A test that asserts only the happy path does not cover the `else`, the `catch` or the early `return`.

## Good
```ts
export const clamp = (n: number) => (n > MAX ? MAX : n);
it('passes small values through', () => expect(clamp(3)).toBe(3));
it('caps values above MAX', () => expect(clamp(MAX + 1)).toBe(MAX));
```

## Bad
```ts
it('clamps', () => expect(clamp(3)).toBe(3)); // the n > MAX branch never runs
```
