# Architecture decision records

One file per decision. Format and rules are the same as in
`UserManagementAPI`, so the two repositories read the same way.

| # | Decision | Status | PR |
|---|---|---|---|
| [0001](0001-spa-not-framework.md) | A Vite SPA rather than a framework with server rendering | Accepted | 1 |
| [0002](0002-react-compiler-enabled.md) | The React Compiler is enabled, and manual memoisation is a defect | Accepted | 1 |
| [0003](0003-feature-module-boundaries.md) | Feature-module boundaries enforced by lint rather than convention | Accepted | 1 |
| [0004](0004-two-token-tiers.md) | Tokens have two tiers, and components may only reference the second | Accepted | 3 |
| [0005](0005-declarative-router.md) | React Router in declarative mode, installed with the specimen route | Accepted | 4 |