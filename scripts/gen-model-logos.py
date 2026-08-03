#!/usr/bin/env python3
"""Regenerates app/lib/model-logos.ts from Simple Icons SVGs.

Fetches each provider icon from cdn.simpleicons.org (CC0) and writes the
path data into a bundled TS module so logos work offline.

Usage: python3 scripts/gen-model-logos.py
"""

import json
import re
import urllib.request

SLUGS = {
    "openai": "openai",
    "anthropic": "anthropic",
    "google": "google",
    "gemini": "googlegemini",
    "googlecloud": "googlecloud",
    "deepseek": "deepseek",
    "huggingface": "huggingface",
    "lmstudio": "lmstudio",
    "ollama": "ollama",
    "openrouter": "openrouter",
    "x": "x",
    "amazonwebservices": "amazonwebservices",
}

CDN = "https://cdn.simpleicons.org/{}"

paths = {}
for name, slug in SLUGS.items():
    with urllib.request.urlopen(CDN.format(slug), timeout=30) as res:
        svg = res.read().decode("utf-8")
    m = re.search(r'<path[^>]*d="([^"]+)"', svg)
    if not m:
        raise SystemExit(f"no path found for {name}")
    paths[name] = m.group(1).strip()
    print(f"ok - {name} ({len(paths[name])} chars)")

lines = [
    "/**",
    " * GENERATED FILE — provider brand SVG paths from Simple Icons",
    " * (https://simpleicons.org, CC0). Regenerate with:",
    " *   python3 scripts/gen-model-logos.py",
    " */",
    "",
    "export const BRAND_LOGO_PATHS: Record<string, string> = {",
]
for name, p in sorted(paths.items()):
    lines.append(f"    {json.dumps(name)}: {json.dumps(p)},")
lines.append("};")
lines.append("")

with open("app/lib/model-logos.ts", "w") as f:
    f.write("\n".join(lines) + "\n")
print(f"wrote app/lib/model-logos.ts with {len(paths)} paths")
