# web source

This directory now contains the active local web application plus the retained frontend-prep manifests.

What is here:
- [App.tsx](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/App.tsx) with the route tree
- [pages](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/pages) for the Figma-derived shell pages
- [components](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/components) for the shell components
- [lib/api.ts](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/lib/api.ts) for backend connections
- [route-manifest.mjs](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/route-manifest.mjs) for the screen inventory
- [component-map.mjs](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/component-map.mjs) for named placeholder components
- [page-shells.mjs](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/page-shells.mjs) for section/state/action evidence per route
- [view-model-adapters.mjs](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/view-model-adapters.mjs) for screen-shaped payloads

Goals of the active app:
- keep the Figma Make route and component structure visible in code
- make the default UX a creator-operator workflow instead of an internal pipeline dashboard
- replace placeholder/demo text with real workflow, clinical, safety-check, export, and governance data
- expose story craft and panel adaptation in a friendly `Story & Panels` step before the full technical panel pages
- keep loading, blocked, stale, disabled, empty, and error states explicit
- keep raw artifact JSON and technical pages behind advanced/developer details by default
- preserve the prep manifests so future builders can still see the intended structure quickly

The next Figma Make source prompt for the simplified creator workflow lives at [figma-make-creator-operator-ui.md](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/docs/prompts/figma-make-creator-operator-ui.md).

The current Figma design file and implemented visual direction are documented at [creator-operator-figma-design.md](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/docs/ui/creator-operator-figma-design.md).
