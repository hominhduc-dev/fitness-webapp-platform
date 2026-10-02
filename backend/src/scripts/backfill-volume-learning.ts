/**
 * One-off: backfills WeeklyMuscleSummary for every trainee with training in the
 * last 16 weeks and learns their landmarks, instead of waiting for the
 * scheduler to work through them a batch at a time.
 *
 *   npm --prefix backend run backfill:volume-learning
 */
import { prisma } from "../lib/prisma"
import { runVolumeLearningPass } from "../services/volume-recovery/volume-learning.job"

async function main() {
  let totals = { backfilled: 0, learned: 0, summarized: 0 }
  for (let pass = 1; ; pass += 1) {
    const result = await runVolumeLearningPass()
    totals = {
      backfilled: totals.backfilled + result.backfilled,
      learned: totals.learned + result.learned,
      summarized: totals.summarized + result.summarized,
    }
    console.log(`pass ${pass}:`, result)
    // A trainee whose logs map to no known muscle stays a candidate; stop once a
    // pass changes nothing rather than looping on them.
    if (result.users === 0 || result.backfilled + result.summarized + result.learned === 0) break
  }
  console.log("done:", totals)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma?.$disconnect())
