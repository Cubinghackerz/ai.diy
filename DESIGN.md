# Design System

## Direction

The landing page is **OLED editorial blackspace**: a product-led, asymmetric first viewport pairs ownership copy with the real ai.diy workspace instead of enclosing the offer in a conventional centered hero card. The page then proves the claim through the Local Data Plane, provider freedom, private workflows, capability controls, and a real deploy terminal. Structure comes from typography, spacing, and hairlines rather than decorative frames.

## Mode

Persuade. Understand BYOK local-first ownership, then open `/workspace` or deploy.

## Palette

- Canvas: OLED `#050505` (`--landing-canvas`)
- Surfaces: `#0c0c0f` / `#08080a`, used only where containment communicates product or terminal structure
- Type: white headings, zinc-400 body, zinc-500/600 metadata
- Borders: restrained `white/[0.08–0.1]` hairlines
- Primary CTA: solid white pill with nested icon circle (`LandingCta`)
- Live signal: mint `#3DFFB0`, reserved for status dots, request routes, and a subtle product underglow
- Provider shelf: static official marks with grayscale-to-color hover; no pill containers or marquee loop

## Typography

- Geist Sans for display and body; Geist Mono only for data, terminal output, status, and sequence labels
- Medium display weight, compact leading, tracking no tighter than `-0.04em`
- Display scale tops out below 6rem; body measure remains near 65 characters
- No gradient text

## Shape And Depth

- The page canvas is open; most evidence uses no card shell
- Product and terminal surfaces earn rounded containment and soft offset shadows
- One ambient white glow at the top and one restrained mint product signal provide depth
- Hairlines divide information; decorative dot fields, SVG noise, stage rails, crosshairs, dashed frames, and nested bezels are not page scaffolding
- Floating island navigation remains the primary chrome

## Composition

1. Floating island navigation
2. Asymmetric ownership hero with real workspace proof and primary actions
3. Local Data Plane trust boundary with one moving request packet
4. Static provider shelf
5. Flat private-workflow evidence
6. Interactive capability lanes
7. Copyable self-host terminal
8. FAQ
9. Quiet, edge-to-edge closing statement and footer

## Motion

- Custom ease `cubic-bezier(0.32, 0.72, 0, 1)` / GSAP power3
- Hero: one blur-up stagger across the reading order
- Local Data Plane: one mint request packet traverses the relay boundary
- Section reveals remain subtle and one-time (`Reveal`)
- No perpetual decorative floaters; honor `prefers-reduced-motion`

## Icons

- Phosphor Light on the landing route only

## Accessibility

- Semantic landmarks, visible focus rings, and at least 40px interactive targets
- Real GitHub stars and deploy commands; no fabricated metrics, testimonials, or customers
- Zinc text contrast is evaluated against `#050505` without route-level color overrides
- Reduced-motion visitors receive visible static final states

## Form Contract

- THESIS: Ownership is a visible mechanism, not a privacy slogan
- FORM: OLED editorial blackspace × asymmetric product proof × hairline instrumentation
