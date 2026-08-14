import compression from "compression"
import cors from "cors"
import express from "express"
import helmet from "helmet"

import { env } from "./config/env"
import { errorHandler, notFoundHandler } from "./middleware/error-handler"
import { apiLimiter } from "./middleware/rate-limit"
import { requestContext } from "./middleware/request-context"
import { apiRouter } from "./routes"

const app = express()

// The API sits behind nginx on the VPS; without this req.ip is the proxy's address
// and every caller would share a single rate-limit bucket.
app.set("trust proxy", 1)

app.use(
  helmet({
    // The API serves JSON only, so the browser-facing policies that assume an HTML
    // document are not applicable; the transport and framing protections are.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
)
app.use(requestContext)
app.use(compression())
app.use(
  cors({
    credentials: true,
    origin: env.frontendUrls,
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

app.use("/api", apiLimiter, apiRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export { app }
