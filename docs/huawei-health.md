# Huawei Health Service Kit integration

This integration lets a trainee connect Huawei Health to YeahBuddy without
exposing Huawei OAuth tokens to the browser.

## Architecture

```text
Huawei Watch / Band
        ↓
Huawei Health
        ↓ cloud sync
Huawei Health Service Kit
        ↓ OAuth + REST
Express backend
        ↓ normalize
HealthConnection / HealthDailySummary / HealthWorkout
        ↓
Recovery + Settings preview
        ↓
Next.js
```

The browser never receives the Huawei client secret, access token, or refresh
token. OAuth code exchange, token refresh, Health Service Kit requests, and
regional API redirects are handled by the Express backend.

## Huawei developer setup

1. Create/configure the web application in HUAWEI Developers.
2. Apply for Health Service Kit.
3. Request only these read scopes:
   - `https://www.huawei.com/healthkit/sleep.read`
   - `https://www.huawei.com/healthkit/heartrate.read`
   - `https://www.huawei.com/healthkit/stress.read`
   - `https://www.huawei.com/healthkit/step.read`
   - `https://www.huawei.com/healthkit/distance.read`
   - `https://www.huawei.com/healthkit/calories.read`
   - `https://www.huawei.com/healthkit/activityrecord.read`
   - `https://www.huawei.com/healthkit/heightweight.read` (optional: a grant
     without it connects and syncs everything except weight)
4. Register the exact OAuth redirect URI:
   - local: `http://localhost:3000/backend/api/integrations/huawei/callback`
   - production: `https://<frontend-origin>/backend/api/integrations/huawei/callback`
5. Add the backend environment values documented in `backend/.env.example`.

Health Service Kit test access is limited by Huawei until the application's
health scopes pass the appropriate verification/review.

## Environment

```bash
HUAWEI_CLIENT_ID=
HUAWEI_CLIENT_SECRET=
HUAWEI_OAUTH_REDIRECT_URI=http://localhost:3000/backend/api/integrations/huawei/callback
HUAWEI_HEALTH_API_BASE=https://health-api.cloud.huawei.com
HUAWEI_TOKEN_ENCRYPTION_KEY=
# Optional, background sync on by default:
# HUAWEI_HEALTH_SYNC_ENABLED=true
# HUAWEI_HEALTH_SYNC_INTERVAL_MS=3600000
```

Generate the encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Do not expose any of these values through `NEXT_PUBLIC_*`.

## HTTP routes

All routes are mounted below `/api/integrations/huawei`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/connection` | Connection state and latest synced summary |
| POST | `/authorize` | Create a signed OAuth authorization URL |
| GET | `/callback` | Verify OAuth state and store encrypted tokens |
| POST | `/sync` | Sync up to 30 days of cloud health data now |
| DELETE | `/connection` | Remove the local Huawei connection |

The sync request accepts:

```json
{
  "days": 7,
  "timezoneOffset": "+0700"
}
```

The frontend derives `timezoneOffset` from the browser. This keeps Huawei's
natural-day aggregation aligned with the date keys used by recovery check-ins.
The offset is stored on the connection and reused by the background sync.

## How data is fetched

Daily values come from `POST /healthkit/v2/sampleSet:dailyPolymerize`, one raw
data type per request (`steps.delta`, `distance.delta`, `calories.burnt`,
`heart_rate`, `resting_heart_rate`, `stress`, and `body_weight` when the
weight scope was granted), each answered with its daily
statistics type. `sampleSet:polymerize` with `groupByTime` is not used: Huawei
refuses it for some types ("please use dailyPolymerize API").

Every source (each data type, sleep records, activity records) is fetched on
its own. A source that fails is logged and reported in the sync result's
`failedSources`; the others still sync, and the columns of the failed source
keep their previously stored values. A sync fails only when every source does.

When the phone and a watch both report the same day, totals (steps, distance,
calories, max heart rate) take the larger reading instead of adding them,
averages are averaged, and minimums take the lower. Overlapping sleep records
are grouped as time intervals, so one night recorded by two devices is counted
once (through the record that saw the most of it) while a separate nap is
still added.

## Sleep

Sleep comes from `com.huawei.health.record.sleep` records. When a record
carries `all_sleep_time`, that is the night's sleep, so awake periods inside
the record are not counted; the stage columns come from `deep_sleep_time`,
`light_sleep_time`, `dream_time` (REM) and `awake_time`. Without them the
record's interval is used and the stages stay null. Durations are read as
milliseconds, or as minutes when the value is 1440 or less.

## Weight

Weight comes from the daily statistics of `com.huawei.instantaneous.body_weight`:
the day's `last` weight (or `avg`) and `avg_body_fat_rate`. Besides
`HealthDailySummary.weightKg`/`bodyFatPct`, each day's weight is written to the
trainee's weight log (`BodyMetricEntry`) at local noon with `source = huawei`
and `externalId = huawei:<date>`, so re-syncs update that one entry. If the
trainee logged a weight themselves that day, theirs wins and the synced entry
is removed.

Timestamps are read by magnitude: `dailyPolymerize` groups are epoch
milliseconds around nanosecond sample points, and health records are
nanoseconds.

## Background sync

The backend syncs every connected trainee about once an hour
(`HUAWEI_HEALTH_SYNC_INTERVAL_MS`, minimum 5 minutes), re-reading the last
3 days because bands often upload late. It uses the offset saved by the
trainee's last manual sync, or the app's default zone if there was none.
`lastSyncAttemptAt` is stamped before each attempt, so a revoked or broken
grant is retried once per interval rather than on every tick. Set
`HUAWEI_HEALTH_SYNC_ENABLED=false` to turn it off.

## Stored data

### HealthConnection

One Huawei grant per trainee. Access and refresh tokens use AES-256-GCM at rest.
The connection also remembers the Health Service Kit regional API after Huawei
returns cross-site error `121001`.

### HealthDailySummary

Provider-neutral daily values currently populated by the MVP:

- steps
- distance
- calories burned
- average/min/max heart rate
- resting heart rate
- average stress score
- sleep duration and deep/light/REM/awake minutes
- weight and body fat (with the weight scope)

Columns for HRV, SpO2 and resting calories are reserved for later phases but
are not requested or populated.

### HealthWorkout

Huawei `ActivityRecord` entries are stored separately from YeahBuddy
`WorkoutLog`. This prevents a wearable-detected activity from being mistaken
for a programmed strength session. A later feature can match records by time and
use Huawei heart-rate/calorie data to enrich an existing workout log.

## Recovery behavior

Huawei data is supplemental, not authoritative over a trainee's manual answers.

When a trainee submits the morning recovery check-in:

1. Manual sleep duration wins when supplied.
2. Otherwise the synced Huawei sleep duration for that date is used.
3. Manual stress wins when supplied.
4. Manual stress and Huawei stress both use the same 1–99 scale, so Huawei's
   average stress score is used directly without converting it to 1–5.
5. Fatigue, soreness, pain, and sleep quality remain on their existing manual scales.
6. `sleepSource` and `stressSource` record whether the effective value was
   `manual` or `huawei`.

Resting HR is stored now but is deliberately not part of readiness v3 yet.
Adding it later should use deviation from an individual baseline rather than a
single population-wide threshold.

## User-side Huawei Health requirement

A successful OAuth connection does not guarantee that cloud data exists. The
user must also allow Huawei Health to open/sync the relevant categories to
Health Service Kit in Huawei Health privacy/data-sync settings.

## Regional Health API handling

Requests start at:

```text
https://health-api.cloud.huawei.com
```

If Huawei returns HTTP 403 with error code `121001` and a `Location` header,
the backend validates the target host, retries the request once, and persists the
regional API origin for subsequent requests. Arbitrary redirect hosts are
rejected.

## Current limitations

- Hourly background polling only; Data Subscription/webhook is not enabled.
- Health Service Kit cloud data is not guaranteed to be real-time.
- Sleep and weight field names follow Huawei's data type references as used
  by other Health Kit clients; they have not been checked against a real
  account yet.
- HRV and SpO2 are deferred so the integration does not ask for scopes it does
  not use.
- Disconnect removes the local grant and encrypted tokens. Provider-side
  authorization revocation can be added once the Huawei revocation flow is
  included in the production review requirements.

## Verification before release

Run:

```bash
npm --prefix backend run prisma:validate
npm --prefix backend run prisma:generate
npm --prefix backend run typecheck
npm --prefix backend run test
npm --prefix backend run build

npm run typecheck
npm run lint
npm run test
npm run build
```

Then test with a Huawei Health test account:

1. Connect Huawei Health in Profile.
2. Confirm callback returns to `/profile?huawei=connected`.
3. Tap Sync.
4. Confirm Settings shows the latest sleep/resting-HR/steps/stress preview.
5. Skip sleep and stress in the morning check-in.
6. Confirm the readiness result displays `Huawei` next to the derived sleep and
   stress values.
7. Enter manual sleep/stress and confirm manual values override Huawei.
