# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability in MemexCore, **please do not open a public issue**.

Instead, report it privately by emailing:

**memexcore@proton.me**

Include:
- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Any suggested fix (optional)

You should receive a response within 72 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Disclosure Policy

- We follow responsible disclosure — vulnerabilities are fixed before being disclosed publicly.
- Credit will be given to reporters in the release notes (unless you prefer to remain anonymous).
- We aim to release a patch within 7 days of confirming a vulnerability.

## Scope

The following are in scope:
- HMAC signature bypass or forgery
- Session hijacking or unauthorized access to context pages
- Path traversal on page IDs
- Rate limiting bypass
- Any issue that exposes context page content without a valid signed URL

Out of scope:
- Denial of service via resource exhaustion (this is a self-hosted tool, not a public SaaS)
- Issues in dependencies — please report those upstream
