// ─── Offline resource cache ──────────────────────────────────────────────────
//
// Bump the version suffix to drop every entry a previous worker stored; the
// activate handler deletes any `yeahbuddy-*` cache not listed here.
const STATIC_CACHE = "yeahbuddy-static-v1"
const PAGES_CACHE = "yeahbuddy-pages-v1"
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE]

const OFFLINE_URL = "/offline.html"
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/favicon-yeahbuddy/favicon.ico",
  "/favicon-yeahbuddy/android-icon-96x96.png",
  "/favicon-yeahbuddy/android-icon-192x192.png",
  "/yeahbuddy-mark.png",
]

// Hashed build output accumulates across deploys; pages hold per-user HTML.
const MAX_STATIC_ENTRIES = 400
const MAX_PAGE_ENTRIES = 24

// Data belongs to TanStack Query and the IndexedDB sync queue, never to this
// cache: a stale API response served here would bypass both.
const BYPASS_PREFIXES = ["/backend/", "/api/", "/auth/", "/_next/image", "/_next/data/"]

// Trainee screens a gym-goer may reopen without signal. Coach and admin screens
// carry other people's data and are deliberately left out.
const OFFLINE_PAGE_PREFIXES = ["/dashboard", "/workout", "/schedule", "/meals", "/progress", "/trackweight"]

const PUBLIC_ASSET_PATTERN = /\.(?:png|jpe?g|svg|ico|webp|avif|woff2?)$/

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE)
    await cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" })))
    await self.skipWaiting()
  })())
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((name) => name.startsWith("yeahbuddy-") && !CURRENT_CACHES.includes(name))
        .map((name) => caches.delete(name)),
    )
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable()
    }
    await self.clients.claim()
  })())
})

self.addEventListener("message", (event) => {
  // Sent on sign-out: cached page HTML embeds the signed-in user's profile.
  if (event.data && event.data.type === "CLEAR_USER_CACHES") {
    event.waitUntil(caches.delete(PAGES_CACHE))
    return
  }

  if (event.data && event.data.type === "CACHE_OFFLINE_PAGE") {
    event.waitUntil((async () => {
      const reply = event.ports && event.ports[0]
      let ok = false
      try {
        const url = new URL(event.data.url, self.location.origin)
        if (url.origin === self.location.origin && isOfflinePage(url)) {
          const response = await fetch(new Request(url.href, { credentials: "include", redirect: "manual" }))
          if (response.ok && response.type === "basic") {
            const cache = await caches.open(PAGES_CACHE)
            await putAndTrim(cache, pageCacheKey(url), response.clone(), MAX_PAGE_ENTRIES)
            ok = true
          }
        }
      } catch (_error) {
        // Warming is best-effort. The normal navigation path still populates
        // the page cache and the client keeps the IndexedDB workout snapshot.
      }
      reply?.postMessage({ ok })
    })())
  }
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (BYPASS_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event, url))
    return
  }

  // RSC payloads for client-side navigation are per-user data; let them fail
  // offline so Next.js falls back to a full navigation, which is handled above.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, request))
    return
  }

  if (url.pathname === "/manifest.json" || PUBLIC_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, request))
  }
})

async function cacheFirst(event, request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  // Only content-hashed production output is marked immutable. `next dev`
  // serves the same paths with no-store, so dev chunks never get pinned here.
  if (response.ok && (response.headers.get("Cache-Control") || "").includes("immutable")) {
    event.waitUntil(putAndTrim(cache, request, response.clone(), MAX_STATIC_ENTRIES))
  }
  return response
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await putAndTrim(cache, request, response.clone(), MAX_STATIC_ENTRIES)
      return response
    })

  if (cached) {
    event.waitUntil(network.catch(() => undefined))
    return cached
  }
  return network
}

async function networkFirstPage(event, url) {
  const { request } = event
  try {
    const preloaded = await event.preloadResponse
    const response = preloaded || await fetch(request)
    // Navigation requests use redirect: "manual", so an auth redirect arrives as
    // an opaque redirect and fails the `basic` check — only real pages are kept.
    if (response.ok && response.type === "basic" && isOfflinePage(url)) {
      const cache = await caches.open(PAGES_CACHE)
      event.waitUntil(putAndTrim(cache, pageCacheKey(url), response.clone(), MAX_PAGE_ENTRIES))
    }
    return response
  } catch (error) {
    const pages = await caches.open(PAGES_CACHE)
    const cachedPage = await pages.match(pageCacheKey(url))
    if (cachedPage) return cachedPage

    const offline = await caches.match(OFFLINE_URL)
    if (offline) return offline
    throw error
  }
}

function isOfflinePage(url) {
  return OFFLINE_PAGE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))
}

// Query strings such as `?logDate=` are read client-side; keying on the path
// lets one cached shell serve every variant.
function pageCacheKey(url) {
  return `${url.origin}${url.pathname}`
}

async function putAndTrim(cache, request, response, maxEntries) {
  await cache.delete(request)
  await cache.put(request, response)
  const keys = await cache.keys()
  // Keys come back in insertion order and the delete above moves a refreshed
  // entry to the end, so the oldest entries are evicted first.
  const excess = keys.length - maxEntries
  for (let index = 0; index < excess; index += 1) {
    const key = keys[index]
    if (new URL(key.url).pathname !== OFFLINE_URL) await cache.delete(key)
  }
}

// ─── Web Push ────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch (_error) {
    payload = { body: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "YeahBuddy"
  const options = {
    badge: payload.badge || "/favicon-yeahbuddy/android-icon-96x96.png",
    body: payload.body || "",
    data: {
      url: payload.url || "/dashboard",
      ...(payload.data || {}),
    },
    icon: payload.icon || "/favicon-yeahbuddy/android-icon-192x192.png",
    tag: payload.tag || "yeahbuddy-notification",
  }

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    updateAppBadge(payload.badgeCount),
  ]))
})

async function updateAppBadge(count) {
  if (!Number.isFinite(count) || count < 0) return

  try {
    if (count > 0 && typeof self.navigator.setAppBadge === "function") {
      await self.navigator.setAppBadge(count)
    } else if (count === 0 && typeof self.navigator.clearAppBadge === "function") {
      await self.navigator.clearAppBadge()
    } else if (count > 0 && typeof self.registration.setAppBadge === "function") {
      await self.registration.setAppBadge(count)
    } else if (count === 0 && typeof self.registration.clearAppBadge === "function") {
      await self.registration.clearAppBadge()
    }
  } catch (_error) {
    // Badging is optional; notification delivery must still succeed.
  }
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    let subscription = event.newSubscription || null

    if (!subscription) {
      try {
        const options = event.oldSubscription && event.oldSubscription.options
        if (options) subscription = await self.registration.pushManager.subscribe(options)
      } catch (_error) {
        // The app will attempt a fresh synchronization on its next foreground.
      }
    }

    const windows = await clients.matchAll({ includeUncontrolled: true, type: "window" })
    windows.forEach((client) => client.postMessage({
      endpoint: subscription ? subscription.endpoint : null,
      type: "PUSH_SUBSCRIPTION_CHANGED",
    }))
  })())
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const requestedUrl = event.notification.data && event.notification.data.url
    ? new URL(event.notification.data.url, self.location.origin)
    : new URL("/dashboard", self.location.origin)
  const safeUrl = requestedUrl.origin === self.location.origin
    ? requestedUrl
    : new URL("/dashboard", self.location.origin)
  const notificationId = event.notification.data && event.notification.data.notificationId
  if (typeof notificationId === "string" && notificationId) {
    safeUrl.searchParams.set("pushNotification", notificationId)
  }
  const targetUrl = safeUrl.href

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
