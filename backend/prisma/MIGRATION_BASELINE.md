# Migration Baseline

This repo originally started with a schema that existed before Prisma migrations were committed.
`20260320_exercise_variations` assumes tables like `Exercise` already exist, so `prisma migrate dev`
fails on a fresh shadow database without a baseline.

## Baseline strategy

- `20260319_initial_schema_baseline` recreates the schema state that existed before
  `20260320_exercise_variations`.
- Fresh environments and Prisma shadow databases can now replay the migration history in order.
- Existing environments must **not** re-run the baseline SQL on a live schema that already contains
  those tables. They should mark the baseline as applied once, then continue with normal deploys.

## Existing environment workflow

1. Ensure `DIRECT_URL` points to the direct Supabase host, not the pooler host.
2. Mark the baseline as applied:

```bash
npm run prisma:resolve:baseline
```

3. Apply any later pending migrations:

```bash
npx prisma migrate deploy
```

## Fresh environment workflow

```bash
npx prisma migrate deploy
```

That flow will execute the baseline and then every later migration in order.
