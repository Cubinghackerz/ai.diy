# Aesthetics

## Palette

- Start with one accent color. Add a second only if needed for semantics (success, error, etc.).
- Neutrals: warm gray or cool gray depending on the accent. Use a tint scale (lightest to darkest) with at least 4 steps.
- Define in `:root`:

```css
:root {
  --c-bg: #fdfdfc;
  --c-surface: #f6f5f3;
  --c-border: #e7e5e2;
  --c-text: #1c1917;
  --c-text-muted: #57534e;
  --c-accent: #d97706;
  --c-accent-hover: #b45309;
  --c-accent-contrast: #fff;
}
```

- Text on accent must always have sufficient contrast. Check with a contrast ratio of 4.5:1 for text, 3:1 for large text and UI components.
- Never use pure black `#000` or pure white `#fff` for surfaces or text — use off-blacks and off-whites. Exception: images.
- Semantic colors (success, error, warning) — only if the site has meaningful states.
- Dark mode: support it if the site is expected to run in both. Use `prefers-color-scheme` or a theme toggle. Set the same palette as CSS variables in `[data-theme="dark"]`.

## Typography

- System font stack for body text. If the project has font files, use them. No Google Fonts unless asked.

```css
:root {
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-serif: Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
```

- One typeface for body, one for display (if the display differs).
- Use a type scale with `clamp()`:

```css
:root {
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.85rem);
  --text-sm: clamp(0.875rem, 0.85rem + 0.125vw, 0.95rem);
  --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.625vw, 1.5rem);
  --text-xl: clamp(1.25rem, 1.125rem + 0.625vw, 1.75rem);
  --text-2xl: clamp(1.5rem, 1.25rem + 1.25vw, 2.5rem);
  --text-3xl: clamp(1.75rem, 1.5rem + 1.25vw, 3rem);
  --text-4xl: clamp(2rem, 1.5rem + 2.5vw, 4rem);
}
```

- Body text: 16px minimum, 1.5 line-height, 0.65em paragraph spacing (or `--space-2`).
- Headings: tight line-height (1.1–1.2), strong weight for display type, letter-spacing normal.
- Don't style the whole page in uppercase — reserve it for eyebrows, labels, and section headers.
- Use `text-wrap: balance` for headings, `text-wrap: pretty` for paragraphs.

## Spacing

- Use a spacing scale based on 4px:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;
  --space-10: 128px;
}
```

- Section spacing: `--space-9` / `--space-10` between major sections, `--space-6` / `--space-7` inside sections.
- Use the scale consistently. Never use arbitrary spacing values like 17px or 38px.
- Vertical rhythm: set paragraph margins via `margin-block` on the elements, not wrapper padding.

## Layout

- Max-width wrapper: `max-width: 1100px; margin-inline: auto; padding-inline: var(--space-5);`.
- Grid: `repeat(auto-fit, minmax(280px, 1fr))` for card grids.
- Two-column layouts: `grid-template-columns: 1fr` on mobile, `repeat(2, 1fr)` on `min-width: 768px`.
- Three-column: `repeat(auto-fit, minmax(280px, 1fr))` handles it naturally.
- Full-bleed sections: negative margin trick or `width: 100vw; margin-inline: calc(50% - 50vw);` — only when needed.
- Sticky elements: use `position: sticky` with a top offset. Never use `position: fixed` for navigation — it fails on mobile browsers.

## Shadows

- Use shadows to lift cards, menus, and modals only. Never for whole sections.
- Soft, layered shadows:

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04);
```

## Borders

- Use borders for inputs, code blocks, tables, and small dividers. Prefer background contrast for section separation.
- Border color: `--c-border` (neutral), 1px solid.
- Radius: `4px` for small elements, `8px` for cards, `12px` for modals. Round for pills and avatars.
- Dividers between items in a list: `border-block-end: 1px solid var(--c-border);` on the items, with `padding-block` on the items.

## Decorative Elements

- Eyebrows: small uppercase label above headings, letter-spacing 0.08em, accent or muted color.
- Badges: small pills with accent background tint or border, `--text-sm`, `--space-2` padding.
- Gradients: use for accents only — buttons, highlights. Never for whole backgrounds unless the site's mood requires it.
- Grain and noise: use a subtle inline SVG noise overlay if the design needs texture. Keep it under 10% opacity.
- Dividers (horizontal rules): use `border-block-end` on container or the `<hr>` element. Never use `border: 0; height: 1px; background: color` hacks.
- Numbered sections ("01 / About"): large display numbers in muted accent color, aligned baseline.

## Image Selection

- Use project images as-is. Never source from external sites unless asked.
- If images are missing, use inline SVG placeholders with a subtle pattern or gradient — never a broken image icon.
- Images in cards: `aspect-ratio: 16/9`, `object-fit: cover`, rounded corners.
- Portrait images: `aspect-ratio: 3/4`, `object-fit: cover`.
- Full-width hero images: use `height: min(60vh, 720px); object-fit: cover;` or `width: 100%; aspect-ratio: 21/9;`.
- Images with transparency (PNG logos): never force a background. Use `mix-blend-mode: multiply` on light backgrounds only.
- Add `loading="lazy"` and `decoding="async"` to all non-hero images.

## Composition

- Visual hierarchy: the page must have one clear focal point per viewport.
- Rule of thirds: place the focal point at intersections of thirds, not centered.
- Alignment: everything aligns to a 4px grid — text baselines, card edges, and gutters.
- Contrast: adjacent sections should differ by background, border, or spacing — never by nothing.
- Balance: distribute visual weight across the viewport. Heavy left + empty right is broken.
- Golden section: use `60% / 40%` splits for hero content vs. media, not 50/50.
