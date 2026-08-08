---
name: api-documentation
version: 1.0.0
description: Generate and improve API documentation from code, OpenAPI/Swagger specs, and examples—covering endpoints, auth, errors, and usage. Use when documenting or clarifying HTTP/RPC APIs.
category: developer
tools:
  - fetch_url
  - run_python
  - create_file
  - generate_file
  - ask_user
  - memory
inputs:
  - name: task
    type: string
    required: true
  - name: spec_or_code
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - filesystem
  - network
  - code_execution
popular: false
---

# API Documentation

## Job charter

Produce accurate, developer-ready API docs: resources, operations, auth, parameters, bodies, responses, errors, and examples. Prefer specs and code as source of truth over inventing endpoints.

## When to activate

- User asks to document an API, improve OpenAPI, write usage guides, or explain endpoints
- Generating examples/SDKs stubs from a known contract
- Do **not** use for general code review (`code-review`) or repo onboarding without an API focus (`github-repository-analysis`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Doc goal (reference, quickstart, changelog) |
| `spec_or_code` | no | OpenAPI/Swagger path, proto, route files, or URL |

## Workflow

1. **Locate contract** — OpenAPI/Swagger, proto, RAML, or framework routes (Express/FastAPI/Rails/etc.).
2. **Inventory operations** — Method, path, operationId, tags, auth requirements.
3. **Detail each operation** — Params (in path/query/header), request schema, response schemas, status codes.
4. **Auth & base URLs** — Schemes, token acquisition, scopes, environments.
5. **Errors** — Standard error envelope; common failure modes.
6. **Examples** — Realistic curl/HTTP examples; redact secrets.
7. **Publish shape** — Markdown reference and/or patched OpenAPI via `create_file`/`generate_file`.

## Decision rules

- If code and OpenAPI disagree, flag conflict; do not silently pick one—prefer asking or marking “needs confirmation”.
- Document only existing behavior unless user asked for a proposed API design (label as proposal).
- Versioning: note URI vs header versioning if present.
- Pagination, rate limits, idempotency keys: document when observed or standard in codebase.
- For public doc sites, fetch existing pages and improve rather than ignore them.

## Tool rules

- `fetch_url`: hosted Swagger, Stoplight, GitHub raw OpenAPI.
- `run_python`: parse YAML/JSON OpenAPI; validate required fields lightly.
- `create_file` / `generate_file`: `openapi.yaml`, markdown reference, postman-ish collections as markdown examples.
- `memory`: base URL, auth scheme, operation index.

## Output contract

```markdown
# API documentation: <api name>

## Overview
Purpose | base URL | auth | versioning

## Quickstart
Minimal successful request

## Operations
### `METHOD /path`
Summary | auth | params | body | responses | example

## Errors
...

## Changelog / gaps vs code
...
```

## Validation

- [ ] Every documented endpoint traced to spec or code
- [ ] Examples match schemas (required fields present)
- [ ] Auth steps are complete enough to call successfully
- [ ] Conflicts between sources called out
- [ ] No real credentials in examples

## Failure handling

- **No spec, sprawling code**: document high-traffic routes first; list undiscovered areas.
- **Incomplete OpenAPI**: generate docs + “spec debt” list of missing response schemas.
- **Internal-only APIs**: avoid assuming public base URLs; use placeholders.
- **GraphQL**: document schema roots, auth, and example queries separately from REST template.
