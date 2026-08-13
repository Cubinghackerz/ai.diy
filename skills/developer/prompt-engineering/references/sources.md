# Sources and license policy

This skill ships **first-party** patterns and templates only. It does not vendor or redistribute third-party system prompt corpora.

## Public corpora (study only)

| Repo | License | Role for this skill |
|------|---------|---------------------|
| [asgeirtj/system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks) | CC0-1.0 (collection packaging) | Optional comparative study via `fetch_url` of a **single** raw file when the user asks |
| [x1xhlol/system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) | GPL-3.0 | Inspiration only—never clone, vendor, index, or paste into repo/outputs |

## Safe study procedure (CC0 repo)

1. User explicitly asks to compare with public examples.
2. Fetch **one** raw URL under `https://raw.githubusercontent.com/asgeirtj/system_prompts_leaks/main/...`.
3. Extract **techniques** (section order, tool discipline, reminder style)—rewrite in original words.
4. Do **not** paste large verbatim blocks into the deliverable or into this repository.
5. Note: CC0 on the collection does not erase vendor Terms of Service that may apply to the underlying prompts—study for technique; do not redistribute.

## Forbidden

- Git submodule / vendored copy of either repo
- Searchable dump or CSV of raw leaked prompts in this project
- Claiming access to secret or “current official” vendor system prompts
- Shipping GPL corpus files as a dependency (copyleft risk)

## Attribution when studying

If a technique was informed by a public file, mention the repo name in Design rationale (e.g. “Structure motifs informed by public CC0 corpus study”)—not a paste of the source text.
