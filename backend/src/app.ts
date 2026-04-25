import compression from "compression"
import cors from "cors"
import express from "express"

import { env } from "./config/env"
import { apiRouter } from "./routes"

const app = express()

app.use(compression())
app.use(
  cors({
    credentials: true,
    origin: env.frontendUrl,
  }),
)
app.use(
  express.json({
    limit: "5mb",
  }),
)

app.get("/", (_req, res) => {
  res.json({
    message: "Fitness app backend is running",
  })
})

app.use("/api", apiRouter)

app.use((_req, res) => {
  res.status(404).json({
    error: "Not Found",
  })
})

export { app }
