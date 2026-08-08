# Design System

## Direction

The landing page is **The Signal Field**: a local-first AI workspace presented inside a controlled ultraviolet LightTunnel. It rejects the generic glass AI-chat hero and makes the product mechanism visible through converging fibers, scopes, channels, meters, and a provider patchbay.

## Mode

Persuade. The visitor should understand the product, trust its ownership model, and open the workspace without reading a specification sheet.

## Palette

- Night field: `#080613` ground, translucent `rgba(17,12,39,.76)` panels, `#f7f4ff` ink.
- Day field: `#eee9ff` ground, translucent white panels, `#19112f` ink.
- Signal accent: ultraviolet `#a855f7` in dark mode and `#7c3aed` in light mode.
- Secondary state: electric blue `#4cc9f0` in dark mode and cyan `#0891b2` in light mode.
- Graticule and borders: low-opacity ink from the active theme.

## Typography

- Display and body: Archivo, loaded alongside the application's existing DM Sans stack.
- Readouts and measurement labels: JetBrains Mono.
- Display tracking stops at `-0.04em`; body copy remains open and readable.

## Shape And Depth

- Instrument panels use a consistent 16px-ish radius and one-pixel hairline bezels.
- CTAs and small controls use full-pill shapes.
- Depth uses soft, warm-tinted shadows; no hard offset shadows.
- Graticules appear only inside instrument or patchbay surfaces where they carry measurement meaning.

## Composition

- The hero is an asymmetric split inside a full-bleed LightTunnel field: claim and action on the left, live signal scope on the right.
- Proof content uses an asymmetric instrument module grid, not equal feature cards.
- The workspace section uses a sticky stack of three real product statements.
- Provider freedom is expressed as a patchbay with the ai.diy workspace as the hub.
- Search integrations use two expansion modules with the real bundled logos.

## Motion And Performance

- The authored moment is the LightTunnel fiber field converging behind a product capability panel.
- LightTunnel uses the page palette: ultraviolet cable rims, electric-blue pulses, and a midnight CSS fallback rather than the supplied purple defaults.
- VU bars, patchbay lines, and the hub ring are ambient only while their gate is in or near the viewport.
- `document.visibilityState` pauses ambient animation when the tab is hidden.
- `prefers-reduced-motion` leaves the trace static and skips GSAP parsing entirely.
- LightTunnel caps device pixel ratio, pauses outside the viewport, pauses in hidden tabs, and renders one static frame for reduced-motion users.
- Hero orbit rings, signal points, workspace-panel entrance, and hover transitions explain convergence and hierarchy rather than adding decorative loops everywhere.
- Below-fold sections use `content-visibility: auto` with intrinsic sizing.
- Route cleanup disconnects observers and reverts GSAP context on unmount.

## Responsive Rules

- Desktop uses the split hero and patchbay diagram.
- Below `md`, the hero stacks with the scope below the copy.
- The patchbay diagram becomes a two-column provider module grid; its decorative SVG wiring is hidden.
- Accordion channels become a vertical stack with one active channel at a time.
- CTAs remain single-line and keyboard-visible.

## Accessibility

- Existing marketing copy and route structure remain stable.
- Theme toggle, links, and accordion controls retain semantic buttons and focus-visible rings.
- Real provider and integration marks keep descriptive alt text.
- No landing copy uses em dashes.
