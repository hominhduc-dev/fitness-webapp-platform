self.addEventListener("push", (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch (_error) {
    payload = { body: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "YeahBuddy"
  const options = {
    badge: payload.badge || "/android-icon-96x96.png",
    body: payload.body || "",
    data: {
      url: payload.url || "/dashboard",
      ...(payload.data || {}),
    },
    icon: payload.icon || "/android-icon-192x192.png",
    tag: payload.tag || "yeahbuddy-notification",
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data && event.notification.data.url
    ? new URL(event.notification.data.url, self.location.origin).href
    : new URL("/dashboard", self.location.origin).href

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ includeUncontrolled: true, type: "window" })
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus()
        if ("navigate" in client) {
          await client.navigate(targetUrl)
        }
        return
      }
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl)
    }
  })())
})
