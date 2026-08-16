# Design System

## Direction

The landing page is **Ethereal Glass × Resend blackspace**, elevated with a **Local Data Plane**: an asymmetric first viewport makes the browser → transit-only Node relay → selected provider trust boundary visible, followed by real workspace proof, provider freedom, compact capability evidence, deployment, and a closing CTA band. Zinc/white light only — never Cloudflare orange, never purple AI glow. Mint `#3DFFB0` is reserved for live status and route indicators.

## Mode

Persuade. Understand BYOK local-first ownership → open `/workspace` or deploy.

## Palette

- Canvas: `#111114` brighter graphite blackspace (`--landing-canvas`)
- Surfaces: `#17171c` / `#0e0e11` glass shells with `white/[0.05–0.1]` fills
- Luminous panels: lifted charcoal gradients with stronger white bloom (hero + closing)
- Solid contrast panel: pure white with black type (workflow CTA)
- Borders: `white/[0.12]`–`white/[0.18]` hairlines; dashed callout frames
- Type: solid white headings; zinc-300 body; zinc-400 meta
- Primary CTA: solid white pills with nested icon circle (`LandingCta`)
- Status: mint `#3DFFB0` for live dots only
- Setup gate: same blackspace glass language as landing; white selected provider chips
- Provider shelf: static density band (no marquee loop); top Downloads marks + lobe-icons
- Deploy: one-click Vercel clone button + terminal tabs

## Typography

- Geist Sans (display/body), Geist Mono (terminal, badges, meta)
- Medium weight display; tracking to `-0.04em`
- No gradient text

## Shape And Depth

- Double-bezel + blueprint frames (corner crosshairs)
- Controls and frames 4–12px radius; luminous panels keep large radii
- Floating island nav; fixed floating CTA on md+ (nav inset to avoid overlap)
- Soft layered shadows; white bloom on luminous panels
- Dot field + vertical stage rails (Cloudflare stage language)

## Composition

1. Island nav + floating CTA
2. Asymmetric hero + Local Data Plane trust boundary
3. Real workspace demo
4. Domain: Device ownership surface
5. Provider shelf
6. Capability rack (tabs)
7. Deploy terminal
8. Closing luminous band
9. Footer

## Motion

- Custom ease `cubic-bezier(0.32, 0.72, 0, 1)` / GSAP power3
- Hero: blur-up stagger + panel scale settle; one request packet traverses the data plane
- Constellation: slow orbital rotation (icons counter-rotate upright)
- Closing floaters: sine yoyo
- Scroll reveals: y + blur clear (`Reveal`)
- Honor `prefers-reduced-motion`

## Icons

- Phosphor Light on the landing route only

## Accessibility

- Semantic landmarks, focus-visible rings, ≥40px hit targets
- Live GitHub stars when available; real deploy commands
- No fabricated metrics, testimonials, or customer logos beyond provider marks we ship
- Reduced-motion: static final states

## Form Contract

- THESIS: Ownership as visible mechanism
- FORM: Ethereal Glass × Resend blackspace × Cloudflare stage structure
