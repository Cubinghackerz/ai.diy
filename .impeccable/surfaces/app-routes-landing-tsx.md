---
version: 1
slug: "app-routes-landing-tsx"
primary_target: "app/routes/landing.tsx"
related_targets: ["app/lib/landing-animations.client.ts","app/root.tsx"]
---

# Landing Surface

## Scope

Landing page at `/`, with the visual system shared only by this marketing surface. Mode: Persuade.

## Visitor

Technical self-hosters evaluating a BYOK, local-first AI workspace. They need to understand ownership, provider freedom, and the path into the workspace within seconds.

## Job And Action

Make the local-first, browser-owned, multi-provider mechanism feel concrete. Primary action: open the workspace. Secondary action: explore free search.

## Proof And Content

Preserve the existing copy and factual claims. Demonstrate the mechanism through the signal-bench hero, provider patchbay, local-first proof modules, workspace stack, and bundled search integrations.

## Chosen Direction

The Signal Field: a midnight ultraviolet LightTunnel is the full first-section background. The unchanged claim and CTAs sit left of a readable workspace capability panel covering keys, models, artifacts, tools, providers, and browser-owned history. The provider section remains a patchbay. Motion is authored around convergence, visible only while relevant, and gated to the viewport and document visibility.

## Constraints

Preserve product copy, routes, brand assets, provider logos, light/dark theme behavior, keyboard focus, reduced-motion support, and responsive collapse. Do not fabricate testimonials, customer logos, prices, benchmarks, or usage claims. Keep landing SSR cacheable, cap WebGL DPR, and avoid continuous client work when the visual is not visible.

## Unresolved

None for this implementation.
