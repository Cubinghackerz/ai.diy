# Design System

## Direction

The landing page is **Vercel/Resend blackfield**: a centered product-window first viewport. Ownership copy and actions sit above the real ai.diy workspace screenshot, not beside it. The page then proves the claim through the Local Data Plane, provider freedom, private workflows, capability controls, and a real deploy terminal. Structure comes from typography, spacing, and hairlines. No gradients.

## Mode

Persuade. Understand BYOK local-first ownership, then open `/workspace` or deploy.

## Palette

- Canvas: `#000000` (`--landing-canvas`)
- Surfaces: `#0a0a0a` / `#111111`, used where containment communicates product or terminal structure
- Type: white headings, zinc-400 body, zinc-500/600 metadata
- Borders: `white/[0.08–0.1]` hairlines
- Primary CTA: solid white pill with nested icon circle (`LandingCta`)
- Live signal: mint `#3DFFB0`, reserved for status dots, cipher glyphs, and the Local Data Plane packet
- Provider shelf: static official marks with grayscale-to-color hover; no pill containers or marquee loop

## Typography

- Geist Sans for display and body; Geist Mono only for data, terminal output, status, and sequence labels
- Medium display weight, compact leading, tracking no tighter than `-0.04em`
- Display scale tops out below 6rem; body measure remains near 65 characters
- No gradient text

## Shape And Depth

- The page canvas is open black; evidence uses hairline containment, not decorative frames
- Product and terminal surfaces earn rounded-2xl shells and a single large offset shadow
- The product bezel may take a gentle pointer tilt (≤3°)
- Hairlines divide information; decorative dot fields, SVG noise, stage rails, crosshairs, dashed frames, nested bezels, and gradients are not page scaffolding
- Floating island navigation remains the primary chrome

## Composition

1. Floating island navigation
2. Centered ownership hero with cipher headline, actions, and a full-width product window
3. Local Data Plane trust boundary with one mint transit packet
4. Static provider shelf
5. Private-workflow evidence as hairline cards
6. Interactive capability lanes
7. Copyable self-host terminal
8. FAQ
9. Quiet, edge-to-edge closing statement and footer

## Motion

- Custom ease `cubic-bezier(0.32, 0.72, 0, 1)` / GSAP power3
- Focal moment: the hero ownership headline decrypts under the cursor (Canvas UI DecryptReveal, mint on `#000`). Hover-capable pointers only; touch and reduced-motion see crisp type
- Remaining hero steps keep the blur-up stagger; the headline is excluded so the cipher owns the entrance
- CTAs magnet toward the pointer; product window tilts
- Section headings use a one-time masked word reveal (`MaskedHeading`); other section reveals stay subtle (`Reveal`)
- Local Data Plane: one mint packet traverses the header band
- No perpetual decorative floaters beyond the single packet; honor `prefers-reduced-motion`

## Icons

- Phosphor Light on the landing route only

## Accessibility

- Semantic landmarks, visible focus rings, and at least 40px interactive targets
- Real GitHub stars and deploy commands; no fabricated metrics, testimonials, or customers
- Zinc text contrast is evaluated against `#000000` without route-level color overrides
- Reduced-motion visitors receive visible static final states

## Form Contract

- THESIS: The product is the proof — a black, flat, Vercel-grade workspace in the first viewport
- FORM: Vercel/Resend blackfield × centered product window × hairline instrumentation
