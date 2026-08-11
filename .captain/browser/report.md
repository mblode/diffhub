status: captured
tool: chrome-cdp
port: 21216

| Surface | URL | Screenshot | HTTP | Console errors |
| --- | --- | --- | --- | --- |
| Landing, 1665×885 | http://127.0.0.1:21216/diffhub | landing-desktop.png | 200 | 5 |
| Landing, 390×844 | http://127.0.0.1:21216/diffhub | landing-mobile.png | 200 | 5 |

## What I looked at and what I saw

The rewritten “Review the whole branch” hero renders as two balanced lines at both widths. The copy and product screenshot align at the top on desktop, the screenshot follows the CTA group on mobile, and neither viewport has horizontal overflow. The five repeated errors per capture are existing local-development PostHog requests blocked by the site CSP; there were no page exceptions or failed first-party assets.
