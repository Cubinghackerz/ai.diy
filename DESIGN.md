# Design System

## Direction

The landing page is **Midnight Flux**: a local-first AI command center rendered as a high-fidelity technical blueprint on a near-pure-black substrate. It pairs surgical achromatic chrome with one cinematic orange-to-iris-to-cyan flux field. Ownership is shown as an inspectable trust boundary, not advertised as a slogan.

## Mode

Persuade. A technical self-hoster should understand BYOK, browser persistence, the server relay boundary, and the path to `/workspace` within one viewport and one short scroll.

## Palette

- Void Black `#040506`: page substrate
- Ink `#07080a`: framed surfaces and elevated canvas
- Obsidian `#111214`: recessed wells and selected neutral states
- Graphite `#1b1c1e`: metadata fills and neutral controls
- Smoke `#383b3f`: structural separators
- Ash `#77797c`: tertiary annotations, adjusted above the original brief for legibility
- Fog `#a5a7aa`: secondary copy
- Mist `#d0d6e0`: primary readings and neutral CTA fill
- Paper White `#ffffff`: display and high-emphasis text
- Quantum Flux: `#ff5e1f` → `#6366f1` → `#02b8cc`

Quantum Flux is restricted to the hero atmosphere, the selected artifact trace, the provider-state tag, and the closing-band ambient field. It is never used as text fill.

## Typography

- Inter Variable or Inter for display and body architecture
- Geist Mono, with IBM Plex Mono/ui-monospace fallback, for commands, measurements, state, and version strings
- Display weight 510, maximum 96px, tracking floor `-0.04em`
- Body 12–17px with 1.55–1.7 line height
- No eyebrow above display headings; headings carry the hierarchy directly

## Shape And Depth

- Base unit: 4px; standard section spacing 112–144px desktop and 88–104px mobile
- Product and system frames: 12px radius
- Primary actions: 8px radius; suggestion primitives: 6px; status tags: pill
- Structural lines: 0.5px translucent white
- Keycap frame: inset top highlight, 0.5px outer ring, inset bottom shade
- Depth comes from material separation and offset black shadows, not floating glow cards

## Composition

1. Fixed floating instrument navigation
2. Full-viewport Quantum Flux hero with working prompt launcher and technical metadata strip
3. Full-fidelity synthetic workspace artifact plus real demo link and provider rail
4. Three-part browser → relay → provider trust-boundary diagram with explicit transit and at-rest caveats
5. Asymmetrical command-center capability gallery with one selected flux trace
6. Accessible deploy terminal and direct source/workspace actions
7. Restrained flux closing band and technical footer

## Components

- Primary CTA: Mist fill, dark type, 8px radius, 44px minimum hit area
- Prompt well: translucent Ink, 0.5px bright border, 12px radius, parent focus halo
- Suggestion chip: transparent black, structural border, 6px radius
- Product frame: Ink surface with keycap shadow stack and compact mono title bar
- Status tag: Graphite or reserved Flux fill, mono uppercase data
- Provider rail: neutralized official marks that restore color only on hover
- Terminal tabs: roving tab focus with Arrow/Home/End keyboard support

## Motion

- One authored moment: slow, large-scale flux drift behind the hero
- Hero content resolves with a 700ms blur-and-translate settle
- No decorative infinite animation outside the atmospheric field
- Hover and focus transitions use 160–180ms ease-out without layout movement
- `prefers-reduced-motion` collapses all animation and transition durations

## Icons

- Phosphor Regular across the landing route
- Authored geometric wireframe brand glyph
- Consistent 14–20px functional glyphs; no emoji or Unicode icon substitutes

## Accessibility

- Semantic landmarks, skip link, descriptive labels, and visible focus states
- Interactive controls use at least 40px targets; primary controls use 44px
- Deploy tabs implement roving focus and announce clipboard success/failure
- Body/interactive contrast targets WCAG AA; hero copy targets AAA
- Provider marks retain text alternatives; decorative diagrams and atmosphere are hidden
- Browser zoom remains available; reduced motion shows the final static composition

## Form Contract

- THESIS: Ownership is an inspectable system, not a privacy slogan; refuse the generic AI glow-card stack.
- OWN-WORLD: Void-black technical substrate, Inter architecture, keycap frames, and rationed flux signals.
- STORY: Bring keys, see the browser-first trust boundary, inspect the workspace, then open or self-host it.
- FIRST VIEWPORT: Floating instrument nav above a 72–96px headline, cinematic flux field, working prompt launcher, and technical meta strip.
- FORM: Midnight Flux command-center blueprint, seed `MIDNIGHT-FLUX-2026`.
