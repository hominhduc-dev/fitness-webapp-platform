import express from "express"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { asyncHandler, validated } from "./validate"
import { errorHandler } from "./error-handler"
import { NotFoundError } from "../services/errors"

function buildApp(configure: (app: express.Express) => void) {
  const app = express()
  app.use(express.json())
  configure(app)
  app.use(errorHandler)
  return app
}

const bodySchema = z.object({
  age: z.coerce.number().int().min(0).max(150),
  name: z.string().trim().min(1).max(20),
})

describe("validated()", () => {
  it("passes the parsed value to the handler", async () => {
    const app = buildApp((instance) => {
      instance.post(
        "/echo",
        validated({ body: bodySchema }, (req, res) => {
          res.json(req.body)
        }),
      )
    })

    const response = await request(app).post("/echo").send({ age: "42", name: "  Minh  " })

    expect(response.status).toBe(200)
    // Coercion and trimming happen before the handler runs, not inside it.
    expect(response.body).toEqual({ age: 42, name: "Minh" })
  })

  it("rejects invalid input with a 422 naming every offending path", async () => {
    const app = buildApp((instance) => {
      instance.post(
        "/echo",
        validated({ body: bodySchema }, (_req, res) => {
          res.json({ reached: true })
        }),
      )
    })

    const response = await request(app).post("/echo").send({ age: "not-a-number", name: "" })

    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe("VALIDATION_FAILED")
    expect(response.body.error.details.map((issue: { path: string }) => issue.path).sort()).toEqual([
      "body.age",
      "body.name",
    ])
  })

  it("does not run the handler when validation fails", async () => {
    const handler = vi.fn((_req: unknown, res: express.Response) => res.json({ reached: true }))
    const app = buildApp((instance) => {
      instance.post("/echo", validated({ body: bodySchema }, handler as never))
    })

    await request(app).post("/echo").send({})

    expect(handler).not.toHaveBeenCalled()
  })

  it("validates route params", async () => {
    const app = buildApp((instance) => {
      instance.get(
        "/workouts/:workoutId",
        validated({ params: z.object({ workoutId: z.uuid() }) }, (req, res) => {
          res.json({ workoutId: req.params.workoutId })
        }),
      )
    })

    const bad = await request(app).get("/workouts/123")
    const good = await request(app).get("/workouts/3f2504e0-4f89-41d3-9a0c-0305e82c3301")

    expect(bad.status).toBe(422)
    expect(bad.body.error.details[0].path).toBe("params.workoutId")
    expect(good.status).toBe(200)
  })

  it("validates the query string", async () => {
    const app = buildApp((instance) => {
      instance.get(
        "/logs",
        validated({ query: z.object({ limit: z.coerce.number().int().max(100).default(20) }) }, (req, res) => {
          res.json({ limit: req.query.limit })
        }),
      )
    })

    expect((await request(app).get("/logs")).body).toEqual({ limit: 20 })
    expect((await request(app).get("/logs?limit=50")).body).toEqual({ limit: 50 })
    expect((await request(app).get("/logs?limit=5000")).status).toBe(422)
  })

  it("forwards a rejected async handler to the error middleware", async () => {
    const app = buildApp((instance) => {
      instance.post(
        "/echo",
        validated({ body: bodySchema }, async () => {
          throw new NotFoundError("Không tìm thấy hồ sơ.")
        }),
      )
    })

    const response = await request(app).post("/echo").send({ age: 1, name: "a" })

    expect(response.status).toBe(404)
    expect(response.body.error.message).toBe("Không tìm thấy hồ sơ.")
  })
})

describe("asyncHandler()", () => {
  it("forwards rejections instead of hanging the request", async () => {
    const app = buildApp((instance) => {
      instance.get(
        "/boom",
        asyncHandler(async () => {
          throw new NotFoundError("Không tìm thấy.")
        }),
      )
    })

    const response = await request(app).get("/boom")

    expect(response.status).toBe(404)
  })

  it("passes through a successful response", async () => {
    const app = buildApp((instance) => {
      instance.get(
        "/ok",
        asyncHandler(async (_req, res) => {
          res.json({ ok: true })
        }),
      )
    })

    expect((await request(app).get("/ok")).body).toEqual({ ok: true })
  })
})
