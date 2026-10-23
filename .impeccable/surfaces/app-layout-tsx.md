---
version: 1
slug: "app-layout-tsx"
primary_target: "app/layout.tsx"
related_targets:
  [
    "src/components/Layout/PageNavigation/index.tsx",
    "src/styles/app-shell.scss",
  ]
---

Scope: Replace the visual system and layout of the Next.js app shell and all existing routes. Mode: Operate.

Audience and task: Onmyoji players inspect account data, understand their relic inventory, and use the existing calculators and speed tools. Success means every route feels like one coherent, easy-to-scan admin workspace while all current information and workflows remain intact. Preserve all data, copy, controls, calculations, route guards, account-history behavior, theme switching, and mobile access.

## Direction contract

THESIS: A straightforward blue-gray working desk: navigation stays visible, each page's existing task and data lead, and no feature is disguised as a marketing page.

OWN-WORLD: Cool slate canvas, white work surfaces, restrained blue-gray active states, thin cool borders, quiet elevation, compact readable sans-serif type, and consistent spacing. Remove the incumbent warm beige/terracotta look without changing semantic rarity or status colors.

STORY: Players find a route in the persistent left menu, then scan the page title, current account data, filters, and results in that order. Existing loading, empty, disabled, error, and success states keep their meaning and actions.

FIRST VIEWPORT: A fixed, scrollable left sidebar carries the product name, existing page links, and existing utility actions. The right pane uses the available width, starts with the existing page heading and content, and keeps tables and controls legible. On wide desktop layouts, pair related summary, filter, and configuration panels in two columns; keep dense result tables full width. On small screens, retain a compact top bar and the existing navigation drawer, remove desktop sidebar offset, use compact page gutters, collapse paired panels to one column, and preserve each page's wrapping and horizontal table scrolling.

FORM: The user pinned the conventional admin-dashboard composition and classic blue-gray palette. This takes precedence over the concept-seed assignment; seed:bc1c0c6c365129af.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
