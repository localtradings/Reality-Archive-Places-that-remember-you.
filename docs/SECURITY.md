# Security

## Reporting A Vulnerability

Do not disclose suspected vulnerabilities through a public GitHub issue. Use GitHub's private vulnerability reporting option in the repository **Security** tab when it is available. Otherwise, contact the repository owner privately through the linked GitHub profile without posting sensitive details publicly. Include:

- Affected route or component.
- Reproduction steps.
- Expected and observed behavior.
- Impact and any proof-of-concept details.

Do not include real credentials, personal data, or destructive payloads.

## Implemented Controls

- Azure credentials remain server-side.
- Azure-backed POST routes require an exact allowed origin.
- Cloud operations require a signed, expiring, HTTP-only, SameSite Strict session.
- Cloud operations require an explicit consent header.
- Access-code attempts and cloud routes are rate limited in process.
- JSON bodies are limited to 256 KB; access-code requests are limited to 4 KB.
- User photos are limited to JPEG, PNG, or WebP files below 3 MB.
- CSP and related response headers restrict framing, object loading, browser permissions, and referrers.
- Error responses do not return credentials or environment values.

## Deployment Requirements

- Set `APP_ORIGIN` to the exact HTTPS production origin.
- Set a random `MICROSOFT_IQ_SESSION_SECRET` of at least 32 characters.
- Set a private `MICROSOFT_IQ_DEMO_ACCESS_CODE` of at least 12 characters.
- Restrict Geoapify public keys by domain and quota.
- Keep Azure keys in the server environment only.
- Add platform or reverse-proxy rate limiting for multi-instance deployments. The included limiter is per process and is not a substitute for edge controls.
- Rotate secrets if they are exposed.
- Keep Next.js and all dependencies on patched versions.

## No Account Or Payment Features

The MVP has no user accounts, checkout, subscriptions, advertisements, or payment SDKs.
