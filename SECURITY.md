# Security Policy

## No warranty, no guaranteed support

Pixel Perfect is a free, volunteer-maintained project, provided **"as is", without warranty of any kind**, as stated in the [MIT License](LICENSE). You use it, and deploy it, **at your own risk**.

The maintainers do **not** commit to any response time, fix, release schedule or supported version. Security reports are handled on a best-effort basis, when and if the maintainers have time.

## Reporting a vulnerability

If you find a vulnerability, please **do not** disclose it in a public issue, discussion or pull request. Report it privately through GitHub's [private vulnerability reporting](https://github.com/bitforcesrl/pixel-perfect/security/advisories/new) (the **Security ▸ Report a vulnerability** button on the repository).

A useful report includes:

- the type of issue (for example SSRF through the screenshot route, auth bypass, secret exposure);
- the affected files, routes or features;
- step-by-step instructions to reproduce it, and a proof of concept if you have one;
- the impact, as you understand it.

A pull request with a fix, sent after the private report, is the fastest way to get a problem solved.

## Notes for anyone deploying it

Pixel Perfect can open arbitrary URLs in a headless browser (`/api/screenshot`). Securing your own deployment is your responsibility. At a minimum:

- always set `SITE_PASSWORD` on a public instance; it also guards the screenshot route;
- keep `FIGMA_TOKEN` and `BROWSERLESS_TOKEN` in your host's secret store, never in the repository;
- remember that saved browser-login sessions (`.sessions/`) contain authentication cookies and must never be committed or shared.
