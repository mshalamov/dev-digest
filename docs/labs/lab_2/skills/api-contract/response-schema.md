---
name: response-schema
description: Flag response-shape changes — a field's type, nullability or requiredness changes, or a nested object or array changes shape.
type: rubric
---
# Response schema

- CRITICAL: a field changes type (`number` → `string`, object → array), becomes nullable, or becomes optional where clients read it without a check.
- CRITICAL: a new required field in a request body.
- Compare against the Zod contract or response schema; if the route has none, say so.

## Good
```ts
const Order = z.object({ id: z.string(), total: z.number(), note: z.string().nullish() }); // added optional
```

## Bad
```ts
- total: z.number(),
+ total: z.string(),        // clients doing total.toFixed() now crash
- email: z.string(),
+ email: z.string().nullable(),
```
