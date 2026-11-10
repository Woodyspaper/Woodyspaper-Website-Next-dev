---
name: Provider email verification
description: Why linking uses the existing account email verifier rather than a separate OTP service.
---
Use the existing authentication service to verify additional provider emails, with explicit consent that verified addresses can also sign in. Do not silently make the provider email the primary website email.

**Why:** The user requested linking a Lightspeed email different from their website email with a code sent to that address. Reusing the trusted email verifier avoids a second mail integration and duplicate code-expiry/rate-limit logic. The tradeoff is that the address becomes a secondary website sign-in address; if that is no longer acceptable, a separate provider-only challenge flow is needed.

**How to apply:** Keep the sign-in consequence visible before sending the code, and check ownership using the authenticated user's fresh server-side verification record, never a browser-provided verification claim.
