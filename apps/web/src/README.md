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
- replace placeholder/demo text with real workflow, clinical, eval, export, and governance data
- keep loading, blocked, stale, disabled, empty, and error states explicit
- preserve the prep manifests so future builders can still see the intended structure quickly
