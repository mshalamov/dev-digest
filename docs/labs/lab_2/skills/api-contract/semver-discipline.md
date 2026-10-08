---
name: semver-discipline
description: Require a major version bump (or a new versioned route) for any breaking API change, and flag a breaking change shipped as a minor or patch.
type: convention
---
# Semver discipline

- Breaking change (see `breaking-change`) → major bump of the package or API version, or a new `/v2/...` route with `/v1` kept.
- Additive change → minor. Fix with no contract change → patch.
- Finding when the diff breaks a contract but the version in `package.json`, the OpenAPI `info.version` or the route prefix does not change. WARNING; CRITICAL for published SDKs.

## Good
```diff
- "version": "1.4.2"
+ "version": "2.0.0"   // removes GET /orders/:id/items
```

## Bad
```diff
- "version": "1.4.2"
+ "version": "1.4.3"   // same release renames `total` → `amount`
```
