# Foundations

## Goal

Design and build sites that look hand-crafted. The goal is to make the site look like a human designer built it — clean, deliberate, and polished. This document covers the core principles of responsive design, performance, and semantics.

## Diagnostic Principles

- Start with the design language: pick a palette, typography, and spacing first, then build.
- The design should be "boring" at the content level and expressive at the composition level. That is: the content should be straightforward to read, and the visual layout should carry the personality.
- Whitespace is a feature, not a bug. Prefer spacing over borders, lines, and boxes.
- Composition check: squint at the page. If you can't identify the main focal point, the hierarchy is wrong.
- The user is always right about their product and content; they are not always right about design. If the content calls for a different layout than the user asked for, say so and offer both options.

## Responsive & Breakpoint Rules

- Mobile-first. Write the base styles for narrow screens, then use `@media (min-width: ...)` to enhance.
- Use `clamp()` to scale type and spacing fluidly between the phone and desktop sizes.
- Test at 320, 768, 1024, and 1440px wide.
- Grid layouts: use `auto-fit` and `minmax()` for simple responsive grids, not fixed column counts with media queries.
- A one- or two-column layout should almost always work with plain block flow, no media queries at all.
- Forms should never be squeezed below 320px: use `min-width: 0` on inputs inside grids or flex layouts.
- Long words and URLs need `overflow-wrap: anywhere` to avoid breaking the layout.
- Use logical properties (`margin-inline`, `padding-block`, `inset-inline`) instead of physical ones.

## Performance

- No external assets unless asked. No CDN links, no Google Fonts, no icon fonts, no image CDNs.
- If images exist in the project, reference them directly. Use `loading="lazy"` on below-the-fold images and `decoding="async"` on all images.
- Inline SVG for icons and simple decorative elements.
- Keep the CSS and JS in single files, and keep them tidy. If the CSS exceeds ~500 lines, consider splitting into multiple files with one `@import` at the top.

## Semantics

- Use the correct element for the job: `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`.
- Every page needs a `main` element. Every `section` needs a heading (h2 or h3). Sections that repeat content (like a feature grid) can have a single heading in the page and `aria-labelledby` on the rest.
- Links: descriptive text. "Read more" alone is not descriptive — pair it with the product name or use aria-label.
- Buttons: `<button>`, never a `<div>` or `<a>`. Buttons in a form must have a `type` attribute (`submit`, `reset`, or `button`).
- Forms: each input needs a visible `<label>` (or a legend + fieldset). Add `aria-describedby` for help text and error messages.
- Dynamic content: use `aria-live="polite"` for content that updates after user actions, `aria-live="assertive"` for urgent updates (form errors, progress).
- Focus styles: every interactive element needs a visible focus-visible style.
- Color alone must never convey meaning — add an icon, label, or border to color-coded statuses.
- Decorative images and icons get `aria-hidden="true"`. Meaningful images get alt text. Icons with meaning get a label.

## Assets Pipeline

- All CSS custom properties live in `:root`. Reference them everywhere; never hardcode.
- CSS is organized into sections with a table of contents at the top.
- JavaScript is vanilla, wrapped in an IIFE, and split into small named functions. No framework, no build step.
- The HTML is hand-written, semantic, and contains no inline styles or scripts.
- If the project already has a structure, follow it. If not, establish this one:

```
index.html
style.css
script.js
images/ (if any)
```

## CSS Philosophy

- One selector per line. No nesting deeper than one level.
- Class-based selectors only. No ID selectors. No element selectors for styling (except reset).
- Mobile-first, with `@media (min-width: ...)` enhancements.
- Prefer `flex` and `grid` over float and absolute positioning. Absolute positioning is for overlays only.
- All colors and sizes come from the design system in `:root`.
- Components are self-contained: every style for a component lives under the component's class name.
- Never use `!important`. If you need it, the architecture is wrong — fix the architecture.
