import { beforeEach, describe, expect, it, vi } from "vitest"

import { warmOfflineWorkoutRoute } from "./service-worker"

class TestMessageChannel {
  port1: { onmessage: ((event: MessageEvent<{ ok?: boolean }>) => void) | null } = { onmessage: null }
  port2 = {
    reply: (data: { ok?: boolean }) => this.port1.onmessage?.({ data } as MessageEvent<{ ok?: boolean }>),
  }
}

describe("offline route warming", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal("MessageChannel", TestMessageChannel)
  })

  it("pins the exact workout document through the controlling worker", async () => {
    const worker = {
      postMessage: vi.fn((_message, ports: Array<TestMessageChannel["port2"]>) => {
        ports[0]?.reply({ ok: true })
      }),
    }
    vi.stubGlobal("navigator", {
      serviceWorker: {
        controller: worker,
        ready: Promise.resolve({ active: worker }),
      },
    })

    await expect(warmOfflineWorkoutRoute("workout/id")).resolves.toBe(true)
    expect(worker.postMessage).toHaveBeenCalledWith(
      { type: "CACHE_OFFLINE_PAGE", url: "/workout/workout%2Fid/start" },
      [expect.any(Object)],
    )
  })
})
