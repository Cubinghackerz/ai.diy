# Motion

Motion is a dial, not a default. Sites at `calm` get hover states and nothing else. Sites at `lively` get entrance animations and gentle scroll reveals. Sites at `dynamic` get everything, plus scroll-scrubbed and particle effects.

## Motion Principle

- Motion is a language with grammar: **what** moves, **how** it moves, **when** it moves — each must be deliberate.
- Every animation has a purpose: direct attention, explain state, or delight. No animation is decoration.
- When the user is interacting (hover, focus, press), respond in under 100ms.
- When the page is state-changing (open, close, scroll reveal), animate in 200–400ms.
- When the page loads, sequence the entrance over 500–900ms max — then stop.

## Duration & Curve

- Base duration: 200ms for micro-interactions, 400ms for transitions, 600ms for reveals.
- Curve: `cubic-bezier(0.2, 0, 0, 1)` — fast start, gentle decay. The iOS-like curve.
- Decelerate in: `cubic-bezier(0.0, 0, 0.2, 1)` for entrances.
- Accelerate out: `cubic-bezier(0.4, 0, 1, 1)` for exits.
- Respect `prefers-reduced-motion` — remove or drastically reduce all animation.

```css
:root {
  --ease-out: cubic-bezier(0.0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Entrance Animations

- Only used on `lively` and `dynamic` sites.
- Elements enter: fade + translate (8–16px from below), scale (0.98 → 1) for cards.
- Sequence: hero first (150ms delay), then below-the-fold elements with 100–150ms stagger.
- Never stagger more than 5 steps (or 600ms) — waiting is painful.
- Use IntersectionObserver with `threshold: 0.15` for scroll-triggered reveals.
- Reveal once per page load. Never re-trigger on scroll up.

```js
const reveal = () => {
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) {
      el.classList.add("is-visible");
    }
  });
};
window.addEventListener("scroll", reveal, { passive: true });
```

## Micro-Interactions

- Hover: translateY(-2px) or background tint on cards, color change on links, scale(1.05) on images.
- Focus: focus-visible ring on interactive elements.
- Active/press: transform scale(0.98) on buttons.
- Buttons: background color + shadow transition, not transform only.
- Mobile menu: slide from the side (translateX(100%) → 0, 300ms).
- Accordion: max-height or grid-rows transition, 300ms.

## Decorative Animation Rules

- `lively`: entrance animations, hover states. Nothing continuous.
- `dynamic`: adds continuous, ambient motion — but only if it doesn't hurt readability.
- Banners and marquees: translateX loop, pause on hover.
- Background gradients: animate `background-position`, never `background-color`.
- Blobs: rotate or scale slowly (6–12s), never fast.
- Text reveals: mask or translateY stagger — never blur.
- Never animate: `width`, `height`, `top`, `left`, `margin`. Use transforms only.
- Scroll-scrubbed: `scroll-behavior: smooth` via JS + rAF — never CSS `position: sticky` tricks.

## Dynamic Effects

- Scroll-scrubbed effects: parallax (translateY, 30–50% of scroll), opacity fades, scale.
- Parallax only on the hero and one or two showcases. Never page-wide.
- Infinite marquees: two copies of content, translateX(0 → -50%), 20–40s duration,
  pause on hover, `aria-hidden` on the duplicate.
- Typing effect: only for monospace brand or code display. Never for marketing copy.
- Animated counters: for stats. Toggle with IntersectionObserver, count up 600–1000ms,
  respect reduced motion (show final value instantly).
- Autoplay carousels: every 5–8s, pause on hover and when tab hidden.
  Respect reduced motion — show first slide only.

## Particle System

Only for `dynamic` sites and for a hero or a specific feature (never for an entire page).

- Canvas-based. Fixed to the hero, `pointer-events: none`.
- Constrain: max 100 particles on desktop, 30 on mobile; pause when tab hidden.
- Opacity fade per particle, small drift, never full-screen overlays.
- Use one accent color plus white particles.

## Per-Element Rules

| Element | Hover | Motion |
| --- | --- | --- |
| Links | color change (no underline slide) | 150ms opacity or color |
| Buttons | bg darken + shadow lift | 200ms bg + 100ms press scale |
| Cards | bg tint + shadow lift | 200ms bg + transform |
| Images | scale 1.05 in overflow hidden | 400ms transform |
| Icons | color change to accent | 200ms color |
| Nav | bg blur + border bottom | 200ms bg + shadow on scroll |
| Hero content | none | 500ms staggered entrance on load |
| Modals | — | 300ms opacity + 200ms translateY(16px→0) |
| Accordion | chevron rotate | 250ms max-height + rotate |
| Form inputs | border color on focus | 200ms border + box-shadow |
| Tabs | active pill slide | 300ms pill animation |
| Toast | — | 300ms slide up + fade in |