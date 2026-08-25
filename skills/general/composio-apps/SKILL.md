---
name: composio-apps
version: 1.0.0
description: Use connected Composio apps (Gmail, GitHub, Notion, Slack, Linear, and more) from chat. Activate when the user wants to read, send, create, or update data in a connected SaaS app.
category: general
tools:
  - ask_user
inputs:
  - name: task
    type: string
    required: true
outputs:
  - name: result
    type: markdown
permissions:
  - network
popular: true
---

# Composio Apps

## Job charter

Help the user act in connected SaaS apps through Composio MCP tools (`mcp_composio_*`). Read first, confirm writes, then execute once.

## When to activate

- User asks to check email, create an issue, post to Slack, update Notion, or similar
- A `mcp_composio_*` tool is listed in ACTIVE TOOLS
- Do **not** use for generic web search, local files, or apps that are not connected

## Workflow

1. **Check access** — If no `mcp_composio_*` tools are listed, tell the user to open Settings → Apps, paste a Composio API key with **sessions write** access, then connect the app.
2. **Prefer reads** — List, search, fetch, or get first so you know the target.
3. **Confirm writes** — Before send, create, update, delete, post, comment, invite, or share, call `ask_user` with:
   - question: a one-line summary of the exact action
   - questionType: `single`
    - options: `Yes` | `No`
4. **Honor the answer** — `No` stops. `Yes` runs that exact action once with unchanged arguments.
5. **Execute once** — Call the matching `mcp_composio_*` tool with the minimum arguments. Do not invent tool names.
6. **Report** — Say what happened, where, and any link or id returned. If the app is locked, share the connect link or send the user back to Settings → Apps.

## Decision rules

- Never send, delete, or overwrite data without confirmation unless the user explicitly disabled “Confirm writes” under Settings → Apps.
- If several apps could apply, ask which one.
- If a tool fails with auth/permission, stop and explain the Settings → Apps fix. Do not retry blindly.
- Destructive tools may already be filtered. Do not work around that.

## Output contract

```markdown
## Done
- Action: …
- App: …
- Result: …
```
