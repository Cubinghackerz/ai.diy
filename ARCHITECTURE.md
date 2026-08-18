# Architecture

ai.diy is a browser-owned AI workspace with a stateless-by-default Node relay.
The product separates workspace ownership from provider execution: the browser
keeps the user's local state, while the server forwards requests to the model
and services selected by the user.

## Request path

```text
Browser
  settings, provider keys, chats, memory, knowledge, Canvas, Preview
        |
        | HTTPS request with the selected provider configuration
        v
Node relay
  model forwarding, model discovery, optional search/MCP/connectors
        |
        +--> selected cloud or local model provider
        +--> explicitly enabled search, fetch, MCP, or connector service
```

The relay is not a hosted model account. It does not require persistent
provider API keys in server environment variables. It can still observe
request traffic while forwarding it, so a hosted instance should be treated as
a credential and data boundary in transit.

## Browser-owned state

The browser stores the workspace data needed to continue work:

- Threads, messages, Canvas artifacts, memory, knowledge-base chunks, usage
  events, and Preview sessions use IndexedDB.
- Settings and provider configuration are persisted through the settings store.
- When Web Crypto and IndexedDB are available, the settings payload is
  encrypted with AES-GCM in localStorage and the envelope key is stored
  separately in IndexedDB.
- Environments without Web Crypto or IndexedDB may fall back to plaintext
  settings storage. The encryption envelope is not a substitute for device,
  browser-profile, or same-origin code security.

## External service boundaries

The selected model receives the prompt, files, and context required for the
model request. Additional services may receive data when the user enables or
uses them:

- Web search, URL fetch, and URL Doctor use server-side network requests.
- Remote MCP and connectors send data to the configured service.
- Client-side S3, WebDAV, and Google Drive backups send selected data directly
  from the browser to the configured storage endpoint.
- Login with ChatGPT is an experimental subscription path using a server-side
  HttpOnly session, not a user-supplied OpenAI API key.

Review enabled tools and their providers before using sensitive material.

## Deployment boundaries

- Self-hosting controls the Node relay, deployment network, operational logs,
  access controls, and rate limits.
- Cloud providers still process requests sent to their endpoints.
- Ollama and other localhost providers work for the server that can reach the
  local endpoint; a remote browser cannot make the server reach its own laptop.
- Public deployments should use HTTPS, authentication or network controls,
  request-size limits, and server rate limiting.

See [README.md](./README.md), [DEPLOYMENT.md](./DEPLOYMENT.md), and
[SECURITY.md](./SECURITY.md) for operational details.
