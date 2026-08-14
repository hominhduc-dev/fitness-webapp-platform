import type { NextFunction, Request, RequestHandler, Response } from "express"
import type { ZodType, z } from "zod"

import { ValidationError } from "../services/errors"

type FieldIssue = {
  message: string
  path: string
}

function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    message: issue.message,
    path: issue.path.join(".") || "(root)",
  }))
}

type TypedRequest<TBody, TParams, TQuery> = Omit<Request, "body" | "params" | "query"> & {
  body: TBody
  params: TParams
  query: TQuery
}

type Schemas = {
  body?: ZodType
  params?: ZodType
  query?: ZodType
}

type InferOr<TSchema, TFallback> = TSchema extends ZodType ? z.infer<TSchema> : TFallback

/**
 * Validates the request against the given schemas and hands the *parsed* values to
 * the handler, fully typed. Coercion and defaults declared in the schema therefore
 * apply before any service sees the input.
 *
 *     router.post("/chat", validated({ body: chatBodySchema }, async (req, res) => {
 *       req.body.message // string, guaranteed non-empty
 *     }))
 */
function validated<TSchemas extends Schemas>(
  schemas: TSchemas,
  handler: (
    req: TypedRequest<
      InferOr<TSchemas["body"], unknown>,
      InferOr<TSchemas["params"], Request["params"]>,
      InferOr<TSchemas["query"], Request["query"]>
    >,
    res: Response,
    next: NextFunction,
  ) => unknown,
): RequestHandler {
  return (req, res, next) => {
    const issues: FieldIssue[] = []

    for (const source of ["body", "params", "query"] as const) {
      const schema = schemas[source]

      if (!schema) {
        continue
      }

      const result = schema.safeParse(req[source])

      if (!result.success) {
        issues.push(...toFieldIssues(result.error).map((issue) => ({ ...issue, path: `${source}.${issue.path}` })))
        continue
      }

      // Express 4 exposes writable body/params/query, so the parsed value replaces
      // the raw one and downstream code cannot accidentally read the unvalidated input.
      Object.defineProperty(req, source, { configurable: true, value: result.data, writable: true })
    }

    if (issues.length > 0) {
      next(new ValidationError("Dữ liệu gửi lên không hợp lệ.", { details: issues }))
      return
    }

    // Promise rejections must be forwarded manually — Express 4 does not await handlers.
    void (async () => {
      try {
        await handler(req as never, res, next)
      } catch (error) {
        next(error)
      }
    })()
  }
}

/** Wraps an async handler that needs no validation so rejections still reach errorHandler. */
function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      try {
        await handler(req, res, next)
      } catch (error) {
        next(error)
      }
    })()
  }
}

export { asyncHandler, validated }
export type { FieldIssue }
