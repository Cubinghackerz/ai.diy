---
name: html-craft
version: 1.0.0
description: Hand-crafted static HTML/CSS/JS site building with modern design patterns, refactoring, and design iteration. Use for any static HTML/CSS/JS website project, new or existing. Use `frontend-design` for React/Next.js, `xlsx` for Excel, `pptx` for PowerPoint. Actions: build, rebuild, redesign, refactor, iterate, fix, modernize, polish, audit, analyze, style, responsive, layout, site.
category: developer
tools:
  - create_file
  - generate_file
  - ask_user
  - memory
inputs:
  - name: task
    type: string
    required: true
outputs:
  - name: result
    type: markdown
permissions:
  - filesystem
popular: false
---

# html-craft: Hand-Crafted Static Sites

Build or refactor static HTML/CSS/JS sites with a refined, human-made design language. Start here, then consult the reference files for specifics. If the site is only a few pages or a single landing page, this skill alone is enough — visit references only when you need details.

## When to activate

- Any static HTML/CSS/JS website task: build, rebuild, redesign, refactor, iterate, fix, modernize, polish, audit, analyze, style
- Design iteration on an existing static site (restyle, responsive fixes, motion, component replacement)
- Do **not** use for React/Next.js frontends (use `frontend-design`), Excel workbooks (use `xlsx`), PowerPoint decks (use `pptx`), or non-UI writing tasks

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | The build/refactor/redesign request, target dial positions, and any content or assets |
| `surface` | no | Existing site files or URLs when refactoring; if files are missing, ask the user for a catalog |

## The Three Dials

Every site you build or refactor must pick a position on each dial. Apply the dials' styles consistently across the whole site — no mixing.

1. **VARIANCE**: How visually expressive is the site?
   - `restrained` — Nearly monochrome. Grid structure, generous whitespace, small type. Subtle interactions only. Example: Swiss editorial.
   - `balanced` — One or two accent colors, restrained decoration, one typographic voice. Example: a thoughtful startup site.
   - `expressive` — Bold color, display type, sculpted layout, animated decoration. Example: a design studio site.
2. **MOTION**: How much motion is on the site?
   - `calm` — No animation except hover states and focus states.
   - `lively` — Hover states, entrance animations, and gentle scroll-triggered reveals.
   - `dynamic` — Everything from `lively`, plus scroll-scrubbed effects, parallax, animated backgrounds, and micro-interactions.
3. **DENSITY**: How much content is packed in?
   - `airy` — Very little content. Huge whitespace, big type. For brand, portfolio, marketing one-pagers.
   - `balanced` — Moderate content. Comfortable spacing, structured layout.
   - `dense` — Content-first. Compact type, tight grids, small spacing. For dashboards, reference materials, docs.

For most marketing sites and portfolios, the default is `balanced / lively / balanced`. For product sites and document sites, `restrained / calm / dense` is appropriate.

## Stack Rules

- **No frameworks, no build step** — vanilla HTML, CSS, and JavaScript only.
- **No dependency on external assets** unless asked: no CDN links, no font files (system fonts or fonts already in the project), no icon libraries, no stock photo sites. Use inline SVG.
- **No inline styles, no inline scripts** — styles go in a stylesheet, behavior goes in a JS file.
- **Standard boilerplate**: a `<meta name="viewport">`, `<html lang="...">` matching the page language, a real `<title>`, and a single-page favicon, which can be inline SVG.

## Workflow

1. **Orient**: Read the existing files, note the overall structure, and determine the current VARIANCE / MOTION / DENSITY dial positions. Determine the target dial positions before editing anything.
2. **Index**: List every unique pattern: page types, components, and style choices.
3. **Inspect**: Read the CSS files and note the existing styles. If files are missing or too long, ask the user to produce a catalog (a list of files and their sizes) or to provide the missing files.
4. **Plan**: Sketch the plan. If the site has more than a few pages, propose component and style refactors. For each page, give an overview of planned visual changes.
5. **Implement**: Write the stylesheet(s) and modify the markup. Refactor the CSS into logical sections. Add a table of contents comment at the top of the stylesheet.
6. **Verify**: Review the work with fresh eyes. Spot common errors: overlapping elements, unclosed tags, double borders, broken spacing, content overflow.

## Decision Rules (Always-Apply Rules)

- **Naming**: Use a consistent naming convention: `component__element--modifier` (BEM-style), `component--modifier`, or plain lowercase-with-dashes. Never mix conventions.
- **Selector style**: One selector per line. Write `p, ul, li` instead of `p, ul, li` on one line. Never nest selectors more than one level. Never use ID selectors for styling.
- **Component structure**: Components should be self-contained with a single root element. All component styles live under the component's class name.
- **No plain text design**: All text must be in a semantic element (h1, h2, p, a, li, etc.). Never add styles to the bare body. All buttons must be `<button>` elements. Never use a `<div>` for a button, link, or icon.
- **Design system**: Define the palette, type scale, and spacing as CSS custom properties in `:root` and reference them everywhere. Never hardcode colors or sizes. If the project already has one, extend it. If not, establish one.
- **Tags and ids**: Every page needs a `main` element. `section` elements need aria-labelledby if they have a visible heading. Give each interactive control (buttons, links, form fields) a proper accessible name.
- **Containers**: Standardize on a max-width wrapper for page content. Make sure wrappers use `margin-inline: auto`, never a hardcoded margin.
- **Unused files**: Flag unused files at the end of your answer — don't delete them.
- **Accessibility**: Do not set `pointer-events: none` on links or buttons. Do not set `overflow: hidden` on the body or html elements. Form fields need a visible label, focus style, and an error style. The interactive elements need a focus-visible style. Use `aria-live` for dynamic content.
- **Icons**: Use inline SVG. Never use image files for icons. Add `aria-hidden="true"` to decorative icons. Icons that convey meaning need a text label, title, or aria-label.
- **Borders and dividers**: Use them sparingly; prefer background contrast to separate elements.
- **Transitions**: Add hover transitions. `transition: 200ms ease-in-out` on interactive elements. Add focus-visible transitions.
- **Responsive**: Start with a mobile-first approach. Test at 320, 768, 1024, and 1440px. Use `clamp()` to scale type and spacing fluidly. Avoid over-dependence on media queries.
- **Shadows**: Use them sparingly, and prefer soft, subtle shadows to hard ones. Use layered shadows for depth, e.g., `box-shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06)`.
- **Whitespace**: Prefer whitespace over borders, lines, and boxes. When in doubt, add padding.
- **Composition**: Squint at your site. If the layout feels lopsided, fix it. Check both horizontal centering and vertical rhythm (base spacing). If any element looks too crowded, expand padding. If any section feels too tall, tighten it.

## Tool Rules

- `create_file` / `generate_file`: write the HTML, CSS, and JS deliverables.
- `ask_user`: ask one clarifying question on dial positions or scope only when the request is ambiguous and the cost of guessing is high.
- `memory`: keep the chosen dial positions and design decisions across the session.
- No network access needed; never fetch external assets or fonts.

## Output Contract

- Complete implementation or a refactor summary containing:
  1. The chosen VARIANCE / MOTION / DENSITY positions
  2. Files created or changed
  3. Preflight checklist results (see `references/ai-tells-and-preflight.md`)
  4. Flagged unused files (never delete them without approval)

## Validation

- Run the Preflight Checklist in `references/ai-tells-and-preflight.md` before finishing.
- Re-read the page: no overlapping elements, unclosed tags, double borders, broken spacing, or horizontal scroll at 320px and 1440px.

## Failure Handling

- Missing or oversized files: ask the user for a file catalog before planning.
- Framework detected (React/Next.js) despite a static-site request: stop and hand off to `frontend-design`.
- Multi-page rebuild scope creep: propose the component/style refactor plan and get one approval before implementing.
- Conflicting dial choices in the request: pick the dial pair that best matches the dominant use case and state the choice explicitly.

## Reference Map

When you need detailed guidance, read the reference files. They are organized so you can read one or two as needed:

| Topic | Reference | When to read |
| --- | --- | --- |
| Core principles, responsive rules, semantics, performance, assets | `references/foundations.md` | Always, before starting |
| Colors, typography, spacing, layout, depth, decoration | `references/aesthetics.md` | When designing or restyling |
| Specific components: navigation, hero, forms, pricing, footer... | `references/components.md` | When building specific sections |
| Animation and motion patterns | `references/motion.md` | When the MOTION dial is `lively` or `dynamic` |
| AI tells (what to avoid), preflight checklist | `references/ai-tells-and-preflight.md` | Always, before finishing |
