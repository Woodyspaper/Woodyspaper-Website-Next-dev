---
name: Migration browser testing
description: Browser-testing fallback when this environment rejects the testing worker.
---

The documented testing subagent was rejected with `Unknown config kind: testing` during this migration. Do not repeatedly attempt the same unavailable worker.

**Why:** Browser interaction verification is still needed for route migrations and cannot be replaced by a static screenshot alone.

**How to apply:** If the runtime still rejects that worker, run the project's Playwright tests directly against the shared proxy. This environment provides a Chromium binary in the Nix store; prefer the available binary over downloading another browser. Intercept outgoing inquiry messages rather than delivering test email.
