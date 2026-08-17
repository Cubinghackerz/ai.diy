# AI Tells & Preflight

Signs that the site was built by AI, and the preflight checklist to run before finishing.

## AI Tells — When to Stop and Fix

- **Div soup**: `div` inside `div` inside `div`, 5+ levels deep. AI loves this. Fix with semantic elements and fewer wrappers.
- **Tailwind-looking structure without Tailwind**: inline utility-ish class names like `text-xl`, `p-4`, `flex` appearing in a vanilla project. Clean them up.
- **Unnecessary icons**: action icons with no label, or icons where text alone would do.
- **Decor-branded cruft**: "About us / Team / Contact" sections crammed on every page, complete with "Let's work together" CTAs. A personal site doesn't need a pitch deck.
- **"Hero, Features, About, Testimonials, Pricing, FAQ, CTA, Contact, Footer"** — the crawler-crafted landing page. If you're defaulting to this 9-section stack, the design is an AI default.
- **Multiple heading levels thrown at random**: h1 > h2 > h3 > h4 for no structural reason. AI loves nesting headings in cards. One h1 per page, and headings should follow a logical outline.
- **Copy-paste marketing copy**: "Unlock the power of..." "Elevate your..." "Supercharge your..." — the corporate AI voice. If the copy reads like every other site, it's a tell.
- **Everything is a grid**: 3-column feature cards, 3-column pricing, 3-column testimonials, everywhere. Vary layouts — pairs, splits, lists, zig-zags.
- **The gradient hero**: blue-to-purple gradient with floating white circles. The default hero for every AI demo. If the site has one, it's an AI tell.
- **Icons in colored squares**: every feature card has a little colored square + icon. Overdone. Vary: plain, no icon, line art, numbered.
- **Buttons everywhere**: primary + secondary buttons stacked in every section. Real sites have one CTA per viewport.
- **The 5-star testimonials**: five stars under every testimonial. Nobody rates themselves 5 stars.
- **Stock photos of "office teams"** and abstract 3D shapes. Generic AI-generated or stock imagery screams AI.
- **Motion for motion's sake**: scroll-triggered animations, parallax, and particles without a reason. If you aren't sure why it moves, remove it.
- **The AI color palette**: slate/indigo, purple gradient, white cards with soft shadows, rounded corners — the default theme of every AI project. Replacing this is the #1 fix.

## Preflight Checklist

Run this checklist before finishing any page or site:

- [ ] HTML: `<!doctype html>`, `lang`, `meta charset`, `meta viewport`, `<title>`, favicon present
- [ ] Sections: each `section` has an `aria-labelledby` or a heading inside it
- [ ] `main` element exists and wraps the page content, `header` wraps nav, `footer` wraps footer
- [ ] All links have a valid `href`, or they're buttons instead
- [ ] Alt text on all images (empty `alt=""` allowed for decorative)
- [ ] No inline styles or inline scripts
- [ ] No ID selectors used for styling
- [ ] No bare element selectors for styling (except reset)
- [ ] No `!important`
- [ ] No hardcoded colors, sizes, or spacing — everything from variables
- [ ] Design tokens (colors, type scale, spacing) defined in `:root`
- [ ] The three dials (VARIANCE / MOTION / DENSITY) chosen and consistent across the site
- [ ] All interactive elements have a `:focus-visible` style
- [ ] Form fields have visible labels, error styles, and `aria-describedby` wiring
- [ ] Buttons have `type` attribute where needed (in forms)
- [ ] Mobile 320px: no horizontal scroll, no overlapping elements, tap targets ≥ 44px
- [ ] Desktop 1440px: no content stretched edge-to-edge, grid stays readable
- [ ] `prefers-reduced-motion` respected (at minimum, on the reduce block)
- [ ] Contrast: text on accent passes 4.5:1, large text and UI 3:1
- [ ] No images referenced from external URLs (unless the project already does this)
- [ ] No unused CSS (nothing has no matching elements) — or flag it in the summary
- [ ] No broken links or anchors
- [ ] No duplicate IDs
- [ ] Spelling is consistent (US or UK, not mixed)
- [ ] The site "squints" well: clear hierarchy, one focal point, balanced composition

## The Golden Rule

When in doubt, take it out. Remove sections, animations, and copy you aren't sure about. A focused page beats a complete one. Fewer elements, better executed, is the whole craft.