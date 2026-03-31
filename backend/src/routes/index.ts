import { Router } from "express"

import { adminRouter } from "./admin.route"
import { authRouter } from "./auth.route"
import { coachRouter } from "./coach.route"
import { exerciseRouter } from "./exercise.route"
import { foodRouter } from "./food.route"
import { healthRouter } from "./health.route"
import { mealRouter } from "./meal.route"
import { notificationRouter } from "./notification.route"
import { progressRouter } from "./progress.route"
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
apiRouter.use("/foods", foodRouter)
apiRouter.use("/meals", mealRouter)
apiRouter.use("/notifications", notificationRouter)
apiRouter.use("/progress", progressRouter)
apiRouter.use("/workouts", workoutRouter)

export { apiRouter }
