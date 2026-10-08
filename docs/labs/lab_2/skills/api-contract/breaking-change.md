---
name: breaking-change
description: Flag any change that breaks an existing public API contract — removed or renamed routes, query/body params or response fields, or a changed HTTP method or status code.
type: rubric
---
# Breaking change

A public contract is anything a client can call or read: route path and method, path/query params, request body fields, response fields, status codes, error codes.

- CRITICAL: removing or renaming a route path segment, a query param, a request body field or a response field; changing the HTTP method or a status code; making an optional request field required.
- Cite the changed line and name the old and new shape.
- Not a finding: adding a new optional field, a new route, or a new enum value that clients may ignore.
- Not a finding: renaming only a path parameter's name (e.g. `/orders/:id` → `/orders/:orderId`) — clients still call the same URL.

## Good
```ts
// old field kept, new one added alongside
return { id, total_cents, total: total_cents / 100 };
```

## Bad
```ts
- app.get('/orders/:id', ...)
+ app.get('/purchases/:id', ...)  // every client calling /orders/123 now gets 404
- return { id, total }
+ return { id, amount }              // `total` silently disappears
```
