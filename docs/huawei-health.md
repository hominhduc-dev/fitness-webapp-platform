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
3. Request only these read scopes for the MVP:
   - `https://www.huawei.com/healthkit/sleep.read`
   - `https://www.huawei.com/healthkit/heartrate.read`
   - `https://www.huawei.com/healthkit/stress.read`
   - `https://www.huawei.com/healthkit/step.read`
   - `https://www.huawei.com/healthkit/distance.read`
   - `https://www.huawei.com/healthkit/calories.read`
   - `https://www.huawei.com/healthkit/activityrecord.read`
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
| POST | `/sync` | Sync up to 30 days of cloud health data |
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
- sleep duration

Columns for HRV, SpO2, weight, body fat, sleep stages, and resting calories are
reserved for later phases but are not requested or populated by the MVP.

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

- Manual sync only; Data Subscription/webhook is not enabled.
- Health Service Kit cloud data is not guaranteed to be real-time.
- Sleep duration currently derives from the returned sleep record interval;
  sleep stages are intentionally left null until their record/sub-data mapping
  is implemented and tested against real Huawei data.
- HRV, SpO2, body composition, and weight are deferred so the MVP does not ask
  for scopes it does not use.
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
