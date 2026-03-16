import { Router } from "express"

import { adminRouter } from "./admin.route"
import { authRouter } from "./auth.route"
import { coachRouter } from "./coach.route"
import { exerciseRouter } from "./exercise.route"
import { healthRouter } from "./health.route"
import { mealRouter } from "./meal.route"
import { workoutRouter } from "./workout.route"

const apiRouter = Router()

apiRouter.get("/", (_req, res) => {
  res.json({
    message: "Fitness app backend API",
    version: "v1",
  })
})

apiRouter.use("/health", healthRouter)
apiRouter.use("/auth", authRouter)
apiRouter.use("/admin", adminRouter)
apiRouter.use("/coach", coachRouter)
apiRouter.use("/exercises", exerciseRouter)
apiRouter.use("/meals", mealRouter)
apiRouter.use("/workouts", workoutRouter)

export { apiRouter }
