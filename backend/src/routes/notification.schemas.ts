import { z } from "zod"

const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
})

const revokePushSubscriptionSchema = z.object({
  endpoint: z.url(),
})

export { pushSubscriptionSchema, revokePushSubscriptionSchema }
