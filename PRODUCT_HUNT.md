# Product Hunt Launch Brief

This brief keeps launch messaging aligned with the product's actual trust
boundaries. Do not invent usage, customer, benchmark, pricing, or social-proof
claims.

## Positioning

### Primary hook

Your AI workspace lives in your browser.

### Short description

Chat across cloud and local models while keeping workspace state in your
browser. Self-host the relay with Node or Docker, bring your own provider keys,
and enable tools such as search, MCP, Python, and agents when you need them.

### Product Hunt tagline direction

Browser-owned AI workspace for cloud, local, and self-hosted models.

### Message order

1. Browser-owned workspace state.
2. Per-request relay with no persistent provider API keys required in server
   configuration.
3. 20+ cloud, subscription, and local provider integrations.
4. Optional search, MCP, Python, artifacts, knowledge, skills, and agents.
5. Node.js or Docker deployment on infrastructure the user controls.

## Gallery sequence

1. Architecture: browser-owned state -> Node relay -> selected model and
   explicitly enabled tools.
2. Provider freedom: switch between a cloud provider and a local endpoint in
   the same workspace.
3. Private knowledge: add a document, search the on-device knowledge base,
   and inspect the answer.
4. Local execution: run Python or a small Linux workflow in the browser and
   show the result quickly.
5. Agent depth: show an approved tool, skill, MCP, or subagent workflow with
   the result visible.
6. Ownership: show `npm run build && npm start` or Docker Compose and the
   browser-owned data boundary.

Use real product captures with sensitive content removed. The first image
should explain the architecture without requiring a visitor to configure a
provider before understanding the product.

## Technical FAQ

### Are provider API keys stored on the ai.diy server?

No persistent provider API key configuration is required on the server. Keys
are entered in the browser and relayed with the request. A hosted relay
operator can observe traffic in transit.

### Is all request data sent only to the selected model provider?

No. The selected model receives the model request, and explicitly enabled
search, URL fetch, MCP, connector, backup, or subscription services have their
own boundaries. Users should review tools before using sensitive data.

### Is browser settings storage encrypted?

When Web Crypto and IndexedDB are available, settings use AES-GCM at rest with
the envelope key stored separately in IndexedDB. Fallback environments may use
plaintext storage. This is not a substitute for device or browser-profile
security.

### Does self-hosting make cloud provider requests private?

No. Self-hosting controls the ai.diy relay and infrastructure. The selected
cloud provider still processes the request. Use an authorized local endpoint
when the model must stay on your network.

### Does the project include model credits?

No. ai.diy is the workspace and relay layer. Users bring authorized provider
keys or connect local models and remain responsible for provider costs,
quotas, availability, and data policies.

## Launch conduct

- The creator should be listed as Maker and answer technical questions in his
  own voice.
- Invite people to try the product and give feedback; do not coordinate votes.
- Respond with specifics about browser storage, relay visibility, tools,
  provider switching, deployment, and limitations.
- Do not paste AI-generated comments into Product Hunt verbatim.
- Correct documentation or product copy publicly when launch feedback reveals
  a real inconsistency.

## Final gates

- Replace the demo hostname with a verified branded domain and build with
  `VITE_SITE_URL`.
- Confirm README, Privacy, Architecture, Security, landing copy, and
  `llms.txt` describe the same trust boundary.
- Complete the Preview and regular-chat switching checks in `QA.md`.
- Record the exact build and deployment commit used for the launch.
