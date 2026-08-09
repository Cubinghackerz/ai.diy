# Design System

## Direction

The landing page is **Ethereal Glass × Resend blackspace**: an OLED persuasion surface for ai.diy where ownership is visible as mechanism — keys stay local, providers converge into a hub, artifacts emerge from chat. Zinc/white mesh light only; no purple AI glow.

## Mode

Persuade. Understand BYOK local-first ownership → open `/workspace` or deploy.

## Palette

- Canvas: `#050505` / black
- Surfaces: `#0A0A0A` with `white/[0.03]` shells
- Borders: `white/[0.06]`–`white/[0.1]` hairlines; inset highlight `rgba(255,255,255,0.06)`
- Type: solid white headings; zinc-400/500 body; zinc-600 meta
- Primary CTA: solid white pills with nested icon circle (button-in-button)
- Status: quiet emerald dot

## Typography

- Geist Sans (display/body), Geist Mono (terminal, badges, meta)
- Medium weight display; tracking to `-0.04em`
- No gradient text

## Shape And Depth

- Double-bezel: outer shell (`rounded-[1.75rem–2rem]` + padding) + concentric inner core
- Floating island nav (detached glass pill, `backdrop-blur-xl`)
- Soft layered shadows; avoid harsh solid borders as the only depth cue
- Logo nodes use `outline` `oklch(1 0 0 / 0.1)`-equivalent white/10

## Composition

- Island nav → hero (announcement, headline, CTAs, product bezel) → provider constellation → asymmetric ownership bento → deploy terminal → footer
- Hero brand-first; one dominant product proof (not a dashboard collage)

## Motion

- Custom ease `cubic-bezier(0.32, 0.72, 0, 1)` for UI (~150–200ms); press `scale(0.96)`
- Hero steps stagger ≤50ms; scroll reveals via IntersectionObserver / lazy GSAP
- Hero pointer parallax on product bezel only (disabled for touch + reduced-motion)
- Provider paths brighten on hover; canvas artifact fades in
- Mobile menu: dimmed overlay + staggered link reveal
- Honor `prefers-reduced-motion`

## Icons

- Phosphor Light on the landing route only

## Accessibility

- Semantic landmarks, focus-visible rings, ≥40px hit targets on nav/CTAs
- Live GitHub stars when available; real README deploy commands
- Reduced-motion: static final states, no parallax/stagger

## Form Contract

- THESIS: Ownership as visible mechanism
- FORM: Ethereal Glass × Resend blackspace (pinnacle redesign)
