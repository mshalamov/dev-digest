---
name: deprecation-policy
description: Require that public fields and routes are deprecated (marked, documented, kept working) before removal, and flag silent removals.
type: convention
---
# Deprecation policy

- Before removing a route or field: keep it working, mark it (`@deprecated` JSDoc, a `Deprecation`/`Sunset` header, or `.describe('deprecated: …')` on the schema), and name its replacement.
- Finding when a public route or field is removed in the same change that introduces its replacement. WARNING; CRITICAL when no replacement exists.
- Removal is fine once a previous release already marked it deprecated — cite that marker.

## Good
```ts
/** @deprecated use `amount`; removed in v3. */
total: z.number(),
amount: z.number(),
```

## Bad
```ts
- total: z.number(),
+ amount: z.number(),   // removed and replaced in one step, no deprecation window
```
