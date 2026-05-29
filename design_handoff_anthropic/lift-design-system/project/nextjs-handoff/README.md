# Next.js handoff — Lift design migration

This folder contains drop-in files to apply Lift's minimal warm-neutral design to the [hominhduc-dev/fitness-app](https://github.com/hominhduc-dev/fitness-app) Next.js codebase.

## Quick start

```bash
# In your fitness-app repo root:
cp <this-project>/nextjs-handoff/app/globals.css ./app/globals.css
cp <this-project>/nextjs-handoff/app/layout.tsx  ./app/layout.tsx
npm run dev
```

That's it for Step 1 — 90% of the app's UI flips to the new style.

See [MIGRATION.md](./MIGRATION.md) for the full playbook (3 more polish steps).
