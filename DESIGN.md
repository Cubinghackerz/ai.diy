# Design System

## Direction

The landing page is **clean, simple, and minimal, in the Vercel style**: a black canvas, Geist, hairlines, solid white actions, and nothing that does not earn its place. It says what the product is, shows it working, and gets out of the way. One column of content, generous space, full-width hairlines between sections, no ornament, no gradients.

The first viewport is a plain headline, one sentence, two buttons, and a scripted, clearly labelled preview of the ai.diy workspace (real text and SVG, not an image). The page then proves the claim in six short sections: ownership (the Local Data Plane), providers, features, self-hosting, FAQ, and a closing call to action.

## Shape Language

- Corners follow the app tokens, `--radius-xs` 1px through `--radius-4xl` 6px, defined once in `app/styles/app.css`. Landing buttons and surfaces use 6px; inner controls 4px.
- The chat surface is the exception. `.legacy-round` (set on the workspace main column in `app/routes/home.tsx`) restores the original soft radii for the header, thread, canvas, and preview panels. The composer keeps its pill shell and circular buttons.
- Structure comes from typography, spacing, and hairlines. Sections are separated by a full-width `white/[0.08]` top border (`Band` in `app/routes/landing.tsx`); content sits in one `max-w-6xl` column with a 24px gutter. No side rails, corner handles, dashed frames, dot fields, noise, nested bezels, or index kickers.

## Mode

Persuade. Understand BYOK local-first ownership, then open `/workspace` or deploy.

## Palette

- Canvas: `#000000` (`--landing-canvas`)
- Surfaces: `#0a0a0a`, used only where containment communicates product or terminal structure
- Type: white headings, zinc-400 body, zinc-500 metadata (the landing scope lifts zinc-500 to zinc-400 for contrast)
- Borders: `white/[0.08–0.1]` hairlines
- Primary action: a solid white button with black text; secondary: the same shape outlined (`LandingCta`). No arrow cells, no magnet effect
- Mint `#3DFFB0` is a small status accent only (the Local Data Plane stage marker, "keys stay in this browser" dot, a done check)
- Provider shelf: static official marks, grayscale until hovered; no pill containers or marquee loop

## Typography

- Landing: Geist Sans for display and body, scoped in `LandingShell`; Geist font stylesheets are linked by the landing route.
- Workspace: Hanken Grotesk for body/UI and Fragment Mono for code/data, from `app/styles/app.css`. The root also loads Bricolage Grotesque; this is not a universal Geist-only system.
- Font stylesheets currently use external CDNs/Google Fonts. Self-hosting is a separate privacy/code-health task.
- Semibold display weight, compact leading, tracking no tighter than `-0.04em`, balanced wrapping (`text-balance`)
- Display scale tops out below 6rem (hero: up to 4.5rem); body measure stays near 65 characters
- Mono is for code, commands, and tiny labels only
- No gradient text

## Composition

1. Flat top bar (`SiteNav`): logo, a few anchors, GitHub, `⌘K` jump palette, and the one primary action
2. Hero: headline, one sentence, "Open workspace" and "View on GitHub", then the scripted preview (`HeroWorkspace`)
3. Ownership: the interactive Local Data Plane (three focusable nodes; "Follow one request" steps a marker through four stages)
4. Providers: a 4×2 shelf of seven marks plus a "+N more" link, and one sentence on subscription sign-in
5. Features: a hairline 3×2 grid (Canvas, Python, Knowledge base, Tools and MCP, Connected apps, Backups) and product-guide links
6. Self-hosting: a copyable command with npm, Docker, and Vercel tabs
7. FAQ (content is mirrored into JSON-LD)
8. Closing statement with two actions, then the footer

## Motion

- Custom ease `cubic-bezier(0.32, 0.72, 0, 1)` / GSAP power3
- Hover and press feedback settles in 150ms; there are no magnet, tilt, decrypt, or masked-word effects
- Hero steps fade in once with a short stagger; section blocks fade in once as they scroll into view (`Reveal`). Reduced-motion visitors get visible final states
- Local Data Plane: one marker, moved only while a visitor steps "Follow one request". Reduced motion and no-JS render the four stages as a numbered list
- Hero preview (`HeroWorkspace`, script in `demo-timeline.ts`): prompt types, Python runs in the tab, the answer streams, a Canvas chart appears, provider chips rotate, then it loops. It is illustrative playback with sample data and says so ("Preview · sample data"); it never claims to be live and invents no metrics or model benchmarks. It renders its finished frame as real DOM text on the server, with no JavaScript and under reduced motion. It plays only while in view and the tab is visible, and it has a visible Pause control (the finished frame shows while paused). The real recorded demo stays one click away. No hero image is on the LCP path
- Motion budget: one preview loop, one stepped marker, no scroll-pinned scene
- Honor `prefers-reduced-motion`

## Icons

- Phosphor Light on the landing route only

## Accessibility

- Semantic landmarks, visible focus rings, and at least 36px interactive targets in the nav and 44px for primary actions
- Real GitHub stars and deploy commands; no fabricated metrics, testimonials, customers, or status claims
- Zinc text contrast is evaluated against `#000000`; metadata never drops below 4.5:1
- Reduced-motion visitors receive visible static final states

## Form Contract

- THESIS: Say what it is, show it working, get out of the way
- FORM: Vercel-style flat bar, full-width hairline sections, one column
- SHAPE: 6px radii on landing surfaces; the workspace chat surface keeps its soft radii
