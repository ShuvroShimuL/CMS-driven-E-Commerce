# Code review and fixes — 15 October 2026

Reviewed the Commerce API checkout, authentication, inventory and webhook flows;
their storefront callers; and the Strapi cart/order contracts.

| Priority | Finding | Fix |
| --- | --- | --- |
| P1 | Checkout accepted client prices, totals and invalid quantities. | Validate and combine cart items; calculate prices, shipping and discounts from server data; use those totals in receipts. |
| P1 | COD verification was a browser flag; account and COD codes shared one namespace. | Consume an email-bound, single-use verification token inside the reservation transaction; isolate OTP purposes and rate-limit COD endpoints. |
| P1 | Checkout refreshed zero stock from a potentially stale CMS value. Sync also ignored reservations and unsynced sales. | Bootstrap missing rows only; subtract reservations and pending CMS decrements; serialize CMS decrements and ignore older webhook versions. |
| P1 | Timeout workers could race confirmation, restore stock twice, and consume coupon usage permanently. | Lock pending transactions before cancellation; release stock and coupon usage atomically; reject expired/cancelled confirmations. |
| P1 | Naive transaction timestamps made expiry depend on timezone. | Store timezone-aware timestamps and create expiry using database time. Migrate existing timestamps as UTC. |
| P1 | Product/courier webhooks were unauthenticated; SSLCommerz trusted callback status without verifying payment. | Require a webhook secret. Disable the stub SSLCommerz callback and reconciliation until a real validation integration exists. |
| P1 | Cart/order REST routes could be exposed through public-role permissions. | Restrict those routes to Strapi API-token authentication and authenticate storefront cart requests. |
| P1 | bKash order fields/status did not exist in the CMS; courier code used another model and field names. | Align order schema, generated types, courier payloads and tracking links. Queue failed order creation in the DLQ. COD remains unpaid. |
| P1 | Maintenance scripts contained credentials; JWT signing used predictable fallback secrets; missing frontend secrets accepted `Bearer undefined`. | Remove embedded credentials, require configured secrets, and reject unconfigured protected endpoints. **Credential rotation is still required outside this patch.** |
| P2 | Refresh tokens could repeat or be reused during concurrent rotation. | Give each refresh token a unique ID and rotate it under a transaction lock. |
| P2 | Expired access tokens caused a login/account redirect loop; order history parsed the wrong response shape. | Allow sign-in with a stale refresh cookie and read the API's orders array. |
| P2 | Logging in could merge a cart into itself; saved carts were not restored without a guest cart. | Skip self-merges, restore saved sessions, and clear the cart cookie on logout. |
| P2 | Bulk inventory sync fetched only the first 100 products. | Follow CMS pagination. |

Validation uses real PostgreSQL SQL through PGlite, with external CMS/email calls
mocked. It covers canonical pricing, invalid carts, stale/unsynced inventory,
OTP binding and reuse, coupon refunds, expiry, confirmation idempotency, schema
compatibility, DLQ recovery, migrations, cart merging and refresh rotation.
The Strapi route test checks that all cart/order methods require API tokens.

PGlite is single-session; these tests do not constitute a multi-worker load test.
External payment, courier and email services were not exercised. Production
builds passed, but frontend prerendering encountered CMS 403 responses. Correct
the configured CMS token permissions before deployment. Existing framework and
browser-data warnings remain outside these fixes.

See README.md for deployment configuration. Deploy all three services together,
rotate the exposed database password and Strapi token, and configure the webhook
Authorization header. No production data was modified and no deployment was made.
