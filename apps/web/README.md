# apps/web

Editorial and reviewer-facing web application.

Current status:
- active React + Vite frontend using the Figma Make shell as the route and component reference
- local-open runtime only; no sign-in, account, profile, or tenant-admin UX
- repo contracts and API views remain the source of truth for labels, data shape, and workflow behavior

Key runtime surfaces:
- [App.tsx](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/App.tsx)
- [pages](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/pages)
- [components](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/components)
- [lib/api.ts](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/lib/api.ts)
- [lib/navigation.ts](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/lib/navigation.ts)

Structural prep artifacts still retained:
- [route-manifest.mjs](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/route-manifest.mjs)
- [component-map.mjs](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/component-map.mjs)
- [page-shells.mjs](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/page-shells.mjs)
- [view-model-adapters.mjs](/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio/apps/web/src/view-model-adapters.mjs)

Core commands:

```bash
pnpm dev:web
pnpm build:web
pnpm --filter @dcp/web test
pnpm --filter @dcp/web typecheck
```

The app should not couple directly to model-provider details or backend orchestration internals. Frontend pages consume the backend read models and mutation endpoints instead.
