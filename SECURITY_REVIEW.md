# Security and code review

Reviewed the storefront, commerce API, and CMS configuration and custom routes on 2026-10-28. The review is risk-focused and does not prove the absence of vulnerabilities.

## Outstanding findings

- **Critical — vulnerable framework dependencies.** `npm audit --omit=dev` reports critical advisories in Next.js 14 and Strapi 4 and their dependencies. npm proposes Next.js 16 and Strapi 5 major upgrades, which require application and data migration. Treat both services as exposed until those upgrades are completed and tested; consult the audit output for the applicable advisories. A forced upgrade without migration testing is unsafe.
- **High — previously committed credentials.** The README records that database and Strapi credentials appeared in old maintenance scripts. Rotate them and audit access; deleting current files does not remove Git history.
- **Medium — review moderation does not synchronize.** Reviews are stored in the commerce database and mirrored to Strapi, but the Strapi webhook handles orders only. Approving the mirrored review in Strapi does not update `commerce_reviews.is_approved`, so it will not appear in the storefront. Add authenticated, idempotent moderation synchronization with reconciliation for failed mirrors.
- **Medium — courier creation can duplicate.** Repeated or concurrent Strapi order-update webhooks can create multiple courier requests before a tracking code is written back. Add durable per-order idempotency and reconciliation with the courier before automating retries.
- **Medium — access-token revocation delay.** Password reset and logout revoke refresh tokens, but previously issued access tokens remain valid for their 15-minute lifetime. Immediate revocation requires server-side session or token-version checks.
- **Operational — rate limits are process-local and IP-based.** Multiple instances do not share limits, and the storefront proxies some requests. Configure a shared rate-limit store and trusted proxy topology for production.

## Changes in this review

Hardened registration, verification and password-reset flows; escaped email content; sanitized CMS article HTML and JSON-LD; kept review access tokens server-side; enforced certificate verification; removed fallback CMS secrets; reduced error disclosure; improved the admin palette and copy; updated compatible dependencies, and ensured the request-specific header is not prerendered as anonymous. The regression tests exercise pending-account takeover, OTP use and reset-token replay.
