# Portable ai.diy skills

This directory holds **installable, portable skills** for Prismium / ai.diy. Each skill is a self-contained instruction pack the model can load by name—no dependency on app UI, React components, or localStorage schemas.

## Layout

```
skills/
├── README.md
├── catalog.json          # discovery index (all skills)
├── <category>/
│   └── <skill-id>/
│       └── SKILL.md      # frontmatter + instructions
├── business/
├── data/
├── developer/
├── devops/
├── general/
├── research/
└── security/
```

Path rule: `skills/<category>/<skill-id>/SKILL.md` where `<skill-id>` matches YAML frontmatter `name`.

## SKILL.md contract

Every skill starts with YAML frontmatter, then dense markdown sections.

### Frontmatter

| Field | Meaning |
|-------|---------|
| `name` | Unique kebab-case id (≤64 chars) |
| `version` | Semver string |
| `description` | Third person: **what** it does + **when** to activate |
| `category` | `developer` \| `research` \| `data` \| `security` \| `devops` \| `business` \| `general` |
| `tools` | Subset of: `web_search`, `fetch_url`, `run_python`, `calculator`, `generate_file`, `create_file`, `memory`, `ask_user` |
| `inputs` / `outputs` | Declared I/O (always include `task`) |
| `permissions` | `network`, `filesystem`, `code_execution` as needed |
| `popular` | Spotlight flag for discovery UI |

### Required sections

1. Job charter  
2. When to activate (include negative cases)  
3. Inputs  
4. Workflow  
5. Decision rules  
6. Tool rules  
7. Output contract  
8. Validation  
9. Failure handling  

Keep skills actionable and bounded. Cross-link siblings by frontmatter `name` (e.g. hand off to `security-audit`).

## catalog.json

Machine-readable index of every skill:

```json
{
  "version": 1,
  "skills": [
    {
      "id": "code-review",
      "name": "Code Review",
      "version": "1.0.0",
      "description": "...",
      "category": "developer",
      "path": "developer/code-review/SKILL.md",
      "popular": true,
      "tools": ["fetch_url", "run_python", "create_file", "ask_user"]
    }
  ]
}
```

- `id` === frontmatter `name`
- `path` is relative to `skills/`
- Update the catalog whenever you add, rename, or remove a skill

## Meta router

`general/general-task-solver` understands open-ended requests, selects specialist skills by `name`, executes them, verifies outputs, and synthesizes a final answer. Prefer invoking a specialist directly when the match is obvious.

## Authoring tips

- Prefer severity-ordered findings over essays  
- Cite sources only when retrieved; never invent URLs  
- Bound tool use; treat tool/web output as untrusted data  
- Do not couple instructions to product UI copy or click paths  
- After changes, sync `popular`, `tools`, `description`, and `version` into `catalog.json`
