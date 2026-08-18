# Security

ai.diy is a local-first, bring-your-own-key application. Its security model
depends on the browser, the selected provider, the relay operator, and any
tools or services enabled by the user.

## Security model

- Provider API keys are entered and persisted by the browser. The Node server
  does not require them as persistent environment configuration.
- Provider keys and request data pass through the relay in transit. A hosted
  instance operator can observe that traffic and its operational metadata.
- Settings use AES-GCM at rest when Web Crypto and IndexedDB are available. The
  envelope key is stored separately in IndexedDB. Browser or platform fallback
  environments may use plaintext storage.
- Encryption at rest does not protect against a compromised device, browser
  profile, malicious same-origin code, browser extensions, or a provider that
  receives the request.
- Web search, URL fetch, MCP, connectors, backups, and ChatGPT subscription
  login have separate data or session boundaries. Enable only what the task
  requires.

## Public deployments

Before exposing an instance beyond a trusted network:

- Use HTTPS and add authentication or an appropriate network access control.
- Configure `RATE_LIMIT_RPM` and keep request-size limits appropriate for the
  deployment.
- Do not log request bodies, provider API keys, cookies, or tool arguments that
  may contain sensitive data.
- Review `CORS_ORIGINS` when the frontend and API use different origins.
- Keep `ALLOW_PRIVATE_PROVIDER_URLS` disabled unless the deployment is trusted
  and the private-network behavior is intentional.
- Review enabled MCP servers, connectors, and backup destinations.

## Reporting a vulnerability

Please do not publish credentials, exploit details, or sensitive proof of
concepts in a public issue. Use GitHub's private vulnerability reporting for
the repository when available. If it is unavailable, open a minimal issue
requesting a private contact channel without including the vulnerability
details.

Include the affected version or commit, reproduction steps, impact, and any
safe mitigation. Do not include live API keys, cookies, tokens, private URLs,
or personal data.
