# Components

A component library for static sites. Every component lists the recommended markup structure, key styles, and accessibility requirements. Adjust to your project's structure and naming convention.

## Navigation

```html
<header class="site-header">
  <nav class="site-nav" aria-label="Main">
    <a href="/" class="site-nav__logo" aria-label="Home">Site</a>
    <ul class="site-nav__list">
      <li><a href="#about">About</a></li>
      <li><a href="#work">Work</a></li>
      <li><a href="#contact" class="site-nav__cta">Contact</a></li>
    </ul>
    <button class="site-nav__toggle" aria-expanded="false" aria-controls="site-menu">
      <span class="visually-hidden">Menu</span>
      <!-- burger icon -->
    </button>
  </nav>
</header>
```

- Sticky header: `position: sticky; top: 0;` with a solid background (blur optional: `backdrop-filter: blur(8px)`).
- Mobile menu: a slide-in panel or dropdown hidden by default, toggled by a button with `aria-expanded` and `aria-controls`.
- Active link: `aria-current="page"` on the current page's link.
- CTA button: accent background, aligns right in the desktop nav.
- Logo: text wordmark or inline SVG, `aria-label` on the link.
- Nav links: `--text-sm`, muted color, hover → text color, no underline (or underline only on hover).

## Hero

```html
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__content">
    <p class="hero__eyebrow">Eyebrow text</p>
    <h1 id="hero-title" class="hero__title">Headline that sells the outcome</h1>
    <p class="hero__subtitle">Supporting paragraph that explains what the product does.</p>
    <div class="hero__actions">
      <a href="#" class="site-btn site-btn--primary">Get started</a>
      <a href="#" class="site-btn site-btn--ghost">Learn more</a>
    </div>
  </div>
  <div class="hero__media"><!-- image or illustration --></div>
</section>
```

- Two-column on desktop, stacked on mobile.
- Headline: `--text-4xl`, `text-wrap: balance`, tight line-height.
- Subtitle: `--text-lg`, muted.
- Imagery: screenshot mockup with browser chrome, or a photo. Slight rotate or shadow for depth.
- The hero must fit in the first viewport without scrolling (or be close to it).
- Optional: subtle entrance animation on load (scale/translate in, 300–600ms).

## Feature Grid

```html
<section class="features" aria-labelledby="features-title">
  <div class="features__header">
    <p class="features__eyebrow">Why us</p>
    <h2 id="features-title">Everything you need</h2>
  </div>
  <ul class="features__grid">
    <li class="feature-card">
      <svg class="feature-card__icon" aria-hidden="true"><!-- icon --></svg>
      <h3>Feature name</h3>
      <p>Feature description.</p>
    </li>
    <!-- more cards -->
  </ul>
</section>
```

- Grid: `repeat(auto-fit, minmax(280px, 1fr))` with `gap: var(--space-5)`.
- Card: `--c-surface` background or border + radius, `--space-5` padding.
- Icon: accent color, in a tinted rounded square.
- Heading: `--text-base` or `--text-lg`, body: `--text-sm` muted.

## Carousel

```html
<div class="carousel" role="region" aria-roledescription="carousel" aria-label="Highlights">
  <div class="carousel__viewport">
    <ul class="carousel__track">
      <li class="carousel__slide">Slide content</li>
    </ul>
  </div>
  <div class="carousel__controls">
    <button class="carousel__prev" aria-label="Previous slide">←</button>
    <button class="carousel__next" aria-label="Next slide">→</button>
  </div>
</div>
```

- Only for repeating content — never for navigation or critical content.
- Prev/next buttons with visible labels or aria-labels.
- Dots: `aria-current` on the active dot.
- Sliding: `translateX` on the track, transitions 400–600ms ease.
- Auto-advance: pause on hover and focus, respect `prefers-reduced-motion`.

## Gallery

```html
<section class="gallery" aria-labelledby="gallery-title">
  <h2 id="gallery-title">Gallery</h2>
  <ul class="gallery__grid">
    <li class="gallery__item">
      <a href="#lightbox" class="gallery__link" aria-label="View image 1">
        <img src="..." alt="..." loading="lazy" decoding="async">
      </a>
    </li>
  </ul>
</section>
```

- Grid with aspect-ratio 1:1 or 4:3, object-fit cover.
- Hover: scale image 1.05 with overflow hidden on the link.
- Optional lightbox: click to open a full-size overlay with close button. `aria-modal="true"` on the dialog.

## Pricing

```html
<section class="pricing" aria-labelledby="pricing-title">
  <h2 id="pricing-title">Pricing</h2>
  <div class="pricing__toggle">
    <button class="pricing__toggle-btn is-active" aria-pressed="true">Monthly</button>
    <button class="pricing__toggle-btn" aria-pressed="false">Annual</button>
  </div>
  <ul class="pricing__grid">
    <li class="pricing-card">
      <h3>Starter</h3>
      <p class="pricing-card__price">$19<span>/mo</span></p>
      <ul>...</ul>
      <a href="#" class="site-btn site-btn--ghost">Start free</a>
    </li>
    <li class="pricing-card pricing-card--featured">
      <p class="pricing-card__badge">Most popular</p>
      <!-- same structure -->
    </li>
  </ul>
</section>
```

- Featured card: accent border or accent-tinted background, slightly larger on desktop.
- Toggle: two buttons in a segmented control, `aria-pressed` on both.
- Price: `--text-2xl` for the number, muted for the period.
- Feature lists: check icon + text, `--text-sm`.

## Testimonials

```html
<section class="testimonials" aria-labelledby="testimonials-title">
  <h2 id="testimonials-title">What people say</h2>
  <ul class="testimonials__grid">
    <li class="testimonial">
      <blockquote>“Quote text.”</blockquote>
      <footer class="testimonial__author">
        <span class="testimonial__name">Name</span>
        <span class="testimonial__role">Role, Company</span>
      </footer>
    </li>
  </ul>
</section>
```

- Blockquote with muted text, `--text-lg`, accent quote mark (inline SVG or ::before).
- Author: name in bold, role in muted.
- Grid: 1 column mobile, 2–3 columns desktop.

## Team

```html
<section class="team" aria-labelledby="team-title">
  <h2 id="team-title">Team</h2>
  <ul class="team__grid">
    <li class="team-member">
      <img src="..." alt="Name" loading="lazy" decoding="async" class="team-member__photo">
      <h3>Name</h3>
      <p class="team-member__role">Role</p>
      <ul class="team-member__social" aria-label="Social links">...</ul>
    </li>
  </ul>
</section>
```

- Photo: round or 3:4 aspect, object-fit cover.
- Name: `--text-base` bold. Role: `--text-sm` muted.
- Social links: inline SVG icons, aria-label with platform names.

## Process / Timeline

```html
<ol class="timeline" aria-labelledby="timeline-title">
  <li class="timeline__step">
    <span class="timeline__number">01</span>
    <div>
      <h3>Discover</h3>
      <p>What we do in this phase.</p>
    </div>
  </li>
</ol>
```

- Vertical list on mobile, alternating or horizontal on desktop.
- Number: accent, mono or display font.

## FAQ Accordion

```html
<section class="faq" aria-labelledby="faq-title">
  <h2 id="faq-title">FAQ</h2>
  <div class="faq__item">
    <h3>
      <button class="faq__question" aria-expanded="false" aria-controls="faq-1">
        Question text
      </button>
    </h3>
    <div class="faq__answer" id="faq-1" hidden>Answer text.</div>
  </div>
</section>
```

- Each question is a button. `aria-expanded` on the button, `hidden` attribute on the answer.
- Only one open at a time is fine; allow multiple is fine too — pick one and be consistent.
- Chevron or plus icon rotates on open.

## Contact Form

```html
<form class="contact-form" method="post" action="#">
  <div class="contact-form__field">
    <label for="name">Name</label>
    <input id="name" name="name" type="text" required>
  </div>
  <div class="contact-form__field">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required>
  </div>
  <div class="contact-form__field">
    <label for="message">Message</label>
    <textarea id="message" name="message" rows="4" required></textarea>
  </div>
  <button type="submit" class="site-btn site-btn--primary">Send</button>
</form>
```

- Labels visible or visually-hidden but present. Float labels are a pattern, not required.
- Inputs: 1px border, radius 4px, padding `--space-2` `--space-3`, focus ring accent color.
- Error: red border + message, `aria-describedby` pointing to the error element.
- Submit: primary button, `aria-busy` while sending.

## Footer

```html
<footer class="site-footer">
  <div class="site-footer__grid">
    <div class="site-footer__brand">
      <p>Logo</p>
      <p class="site-footer__blurb">One-line description.</p>
    </div>
    <nav class="site-footer__nav" aria-label="Footer">
      <ul>
        <li><a href="/about">About</a></li>
        ...
      </ul>
    </nav>
    <div class="site-footer__social">...</div>
  </div>
  <p class="site-footer__legal">© 2024 Company. All rights reserved.</p>
</footer>
```

- Dark background (contrast) or the page background with a top border.
- Grid: 1 column mobile, brand + nav columns on desktop.
- Social icons: inline SVG, muted → accent on hover.

## Cookie Banner

```html
<div class="cookie-banner" role="dialog" aria-labelledby="cookie-title" aria-modal="false">
  <p id="cookie-title">We use cookies to improve your experience.</p>
  <button class="site-btn site-btn--primary">Accept</button>
  <button class="site-btn site-btn--ghost">Decline</button>
</div>
```

- Fixed at the bottom, appears after load.
- Safe focus trap or focus the first button when opened.

## Back to Top

```html
<button class="back-to-top" aria-label="Back to top">↑</button>
```

- Fixed bottom-right, hidden until scroll passes 400px, then slides in.
- Smooth scroll to top on click.

## Badges & CTAs

- Badge: pill, `padding: var(--space-1) var(--space-2)`, `font-size: var(--text-xs)`, accent or border style.
- Buttons (`site-btn`):
  - `--primary`: accent background, white text, hover darkens.
  - `--ghost`: transparent, border 1px, hover tinted.
  - `--link`: text link with underline on hover.
- All buttons: `border-radius: 6px`, `transition: 200ms ease-in-out`, focus-visible ring.

## Popovers

```html
<div class="popover" role="dialog" aria-labelledby="popover-title" aria-modal="true" hidden>
  <h2 id="popover-title">Title</h2>
  <button class="popover__close" aria-label="Close">×</button>
</div>
```

- For focused single actions — never for navigation (use a page or a modal for that).
- Close button with aria-label, focus trap, Escape to close.

## Modal

```html
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden>
  <div class="modal__overlay" data-modal-overlay></div>
  <div class="modal__panel">
    <h2 id="modal-title">Title</h2>
    <button class="modal__close" aria-label="Close">×</button>
  </div>
</div>
```

- Overlay: `rgba(0,0,0,.4)` backdrop.
- Panel: surface background, radius 12px, shadow-lg, max-width 480px.
- Body scroll lock: `overflow: hidden` on body while open — restore after close.
- Focus trap, Escape to close, click overlay to close, focus the panel on open.

## Mobile Menu

```html
<div class="mobile-menu" role="dialog" aria-label="Menu" hidden>
  <nav aria-label="Mobile">
    <ul>
      <li><a href="#about">About</a></li>
    </ul>
  </nav>
  <button class="mobile-menu__close" aria-label="Close menu">×</button>
</div>
```

- Full-screen or slide-in panel from the side.
- Same structure as desktop nav, vertical list, large tap targets (min 44px).
- Body scroll lock + focus trap while open.

## Filter Controls

```html
<div class="filters" role="group" aria-label="Filter work">
  <button class="filters__btn is-active" aria-pressed="true">All</button>
  <button class="filters__btn" aria-pressed="false">Web</button>
  <button class="filters__btn" aria-pressed="false">Brand</button>
</div>
```

- Segmented control: pill buttons with active state.
- Only if the list is long enough to warrant it (+8 items ideally). Otherwise, show all.