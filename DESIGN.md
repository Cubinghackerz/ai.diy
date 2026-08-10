# Design System

## Direction

The landing page is **Ethereal Glass × Resend blackspace**, elevated with **Cloudflare-scale structure**: luminous full-bleed panels, dotted stage rails, ownership constellation, logo marquee, workflow telemetry, and a closing CTA band. Zinc/white light only — never Cloudflare orange, never purple AI glow.

## Mode

Persuade. Understand BYOK local-first ownership → open `/workspace` or deploy.

## Palette

- Canvas: `#111114` brighter graphite blackspace
- Surfaces: `#17171c` / `#0e0e11` glass shells with `white/[0.05–0.1]` fills
- Luminous panels: lifted charcoal gradients with stronger white bloom (hero + closing)
- Solid contrast panel: pure white with black type (workflow CTA)
- Borders: `white/[0.12]`–`white/[0.18]` hairlines; dashed callout frames
- Type: solid white headings; zinc-300 body; zinc-400 meta (contrast lift)
- Primary CTA: solid white pills with nested icon circle
- Status: quiet emerald dot
- Setup gate: same blackspace glass language as landing; white selected provider chips
- Provider shelf: static grid (no marquee loop); top Downloads marks + lobe-icons
- Deploy: one-click Vercel clone button + terminal tabs

## Typography

- Geist Sans (display/body), Geist Mono (terminal, badges, meta)
- Medium weight display; tracking to `-0.04em`
- No gradient text

## Shape And Depth

- Double-bezel + blueprint frames (corner crosshairs)
- Floating island nav; fixed floating CTA on md+
- Soft layered shadows; white bloom on luminous panels
- Dot field + vertical stage rails (Cloudflare stage language)

## Composition

1. Island nav + floating CTA
2. Luminous hero panel → product demo
3. Domain: Device constellation + ownership surface
4. Provider marquee
5. Capability rack (tabs)
6. Hosted vs owned split
7. Workflow telemetry + white ownership panel
8. Profile showcase
9. Deploy terminal
10. Closing luminous band
11. Footer

## Motion

- Custom ease `cubic-bezier(0.32, 0.72, 0, 1)` / GSAP power3
- Hero: blur-up stagger + panel scale settle
- Marquee: infinite horizontal track
- Constellation: slow orbital rotation (icons counter-rotate upright)
- Closing floaters: sine yoyo
- Scroll reveals: y + blur clear
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
