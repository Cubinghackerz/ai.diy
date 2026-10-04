# Design System

## Direction

The landing page is **Vercel/Resend blackfield with an instrumented, squared frame**: a centered product-window first viewport. Ownership copy and actions sit above the real ai.diy workspace screenshot, not beside it. The page then proves the claim through the Local Data Plane, provider freedom, private workflows, capability controls, and a real deploy terminal. Structure comes from typography, spacing, hairlines, and a numbered section grid. No gradients.

## Shape Language

- Corners are square: `--radius-xs` 1px through `--radius-4xl` 6px, defined once in `app/styles/app.css`. Every non-chat surface reads those tokens, so a shape change is a token change.
- The chat surface is the exception. `.legacy-round` (set on the workspace main column in `app/routes/home.tsx`) restores the original soft radii for the header, thread, canvas, and preview panels. The composer keeps its pill shell and circular buttons.
- Status dots, pills, and controls are rectangles or near-rectangles; only the composer and genuinely circular affordances (avatars, switch thumbs, spinner) stay round.
- Evidence sits inside a hairline rail: the landing `main` is one `max-w-6xl` column with side borders, and each section is separated by a shared top border. Sections carry a mono index kicker (`SectionLabel`, "01 / OWNERSHIP") and a mint 6px square.
- Hero evidence is framed with `CornerFrame` selection handles, the squarish signature.
- Wordmark: the closing band sets `ai.diy` as outlined type that fills in on hover.

## Mode

Persuade. Understand BYOK local-first ownership, then open `/workspace` or deploy.

## Palette

- Canvas: `#000000` (`--landing-canvas`)
- Surfaces: `#0a0a0a` / `#111111`, used where containment communicates product or terminal structure
- Type: white headings, zinc-400 body, zinc-500/600 metadata
- Borders: `white/[0.08–0.1]` hairlines
- Primary CTA: solid white rectangle with a squared nested arrow cell (`LandingCta`)
- Live signal: mint `#3DFFB0`, reserved for status squares, cipher glyphs, and the Local Data Plane packet
- Provider shelf: static official marks with grayscale-to-color hover; no pill containers or marquee loop

## Typography

- Landing: Geist Sans for display and body, scoped in `LandingShell`; Geist font stylesheets are linked by the landing route.
- Workspace: Hanken Grotesk for body/UI and Fragment Mono for code/data, from `app/styles/app.css`. The root also loads Bricolage Grotesque; this is not a universal Geist-only system.
- Font stylesheets currently use external CDNs/Google Fonts. Self-hosting is a separate privacy/code-health task, not part of this reliability milestone.
- Medium display weight, compact leading, tracking no tighter than `-0.04em`
- Display scale tops out below 6rem; body measure remains near 65 characters
- No gradient text

## Shape And Depth

- The page canvas is open black; evidence uses hairline containment, not decorative frames
- Product and terminal surfaces earn square shells (2–3px) and a single large offset shadow
- The product bezel may take a gentle pointer tilt (≤3°)
- Hairlines divide information; decorative dot fields, SVG noise, dashed frames, gradients, and nested bezels are not page scaffolding. The single rail around `main` and its section dividers are the only structural lines
- Floating island navigation remains the primary chrome, squared and hairline-bordered

## Composition

1. Floating island navigation
2. Centered ownership hero: status row, cipher headline, one-line sub copy, actions, a copyable `git clone` chip, and a corner-framed product window
3. Key-facts band inside the rail
4. Interactive Local Data Plane: three focusable nodes and one mint packet stepped through a request
5. Static provider shelf
6. Composio app shelf (12 marks; the rest is a text claim)
7. In-use evidence (Canvas, browser Python, Knowledge Base) plus product-guide links
8. Interactive capability lanes (Tools, Canvas, Python, Storage; deploy lives in the terminal section)
9. Copyable self-host terminal
10. FAQ
11. Changelog
12. Closing statement with outlined wordmark, then footer

## Motion

- Custom ease `cubic-bezier(0.32, 0.72, 0, 1)` / GSAP power3
- Press and hover feedback settles in 150ms; the primary CTA scales to 0.97 on press
- Focal moment: the hero ownership headline decrypts under the cursor (Canvas UI DecryptReveal, mint on `#0a0a0a`). Hover-capable pointers only; touch and reduced-motion see crisp type
- Remaining hero steps keep the blur-up stagger; the headline is excluded so the cipher owns the entrance
- CTAs magnet toward the pointer; product window tilts
- Section headings use a one-time masked word reveal (`MaskedHeading`); other section reveals stay subtle (`Reveal`)
- Local Data Plane: one mint packet, moved only while a visitor steps "Follow one request". No looping packet. Reduced motion and no-JS render the four stages as a numbered list
- Closing wordmark fills from outline to a 6% wash on hover
- Motion budget: one packet, one headline decrypt, no scroll-pinned scene
- Honor `prefers-reduced-motion`; reduced-motion visitors get visible static final states

## Icons

- Phosphor Light on the landing route only

## Accessibility

- Semantic landmarks, visible focus rings, and at least 40px interactive targets
- Real GitHub stars and deploy commands; no fabricated metrics, testimonials, or customers
- Zinc text contrast is evaluated against `#000000` without route-level color overrides
- Reduced-motion visitors receive visible static final states

## Form Contract

- THESIS: The product is the proof — a black, flat, Vercel-grade workspace in the first viewport
- FORM: Vercel/Resend blackfield × squared instrumented rail × centered product window
- SHAPE: 1–6px radii everywhere except the workspace chat surface, which keeps its soft radii
