---
name: excessive-mocking
description: Flag tests that mock the unit under test or its own collaborators so heavily that the assertion only checks the mock.
type: rubric
---
# Excessive mocking

Mock the outside world (network, clock, LLM, filesystem), not the code being tested.

- Finding when a test mocks a function from the same module it tests, or when every collaborator is mocked and the test asserts only that a mock was called.
- Finding when the expected value is copied from the mock's return value (the test proves nothing).
- Suggest the real collaborator or a fake at the system boundary instead. WARNING.

## Good
```ts
const repo = new InMemoryOrders();           // fake at the boundary
await placeOrder(repo, { sku: 'A', qty: 2 });
expect(await repo.count()).toBe(1);
```

## Bad
```ts
vi.mock('./pricing', () => ({ total: () => 42 }));
expect(checkoutTotal(cart)).toBe(42);        // asserts the mock, not checkout
```
