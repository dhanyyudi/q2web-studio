const previewStore = new Map();
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const PREVIEW_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https:; worker-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  pruneExpiredEntries();
  const data = event.data || {};
  if (data.type === "preview:publish") {
    previewStore.set(data.token, {
      updatedAt: Date.now(),
      entries: new Map((data.entries || []).map((entry) => [normalizePath(entry.path), entry]))
    });
    event.ports?.[0]?.postMessage({ type: "preview:ready", token: data.token });
    return;
  }
  if (data.type === "preview:evict") {
    previewStore.delete(data.token);
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const match = url.pathname.match(/^\/preview\/([^/]+)\/(.+)$/);
  if (!match) return;

  pruneExpiredEntries();
  const [, token, rawAssetPath] = match;
  const bucket = previewStore.get(token);
  const assetPath = normalizePath(rawAssetPath);
  const entry = bucket?.entries.get(assetPath);

  if (!entry) {
    event.respondWith(new Response("Not found", { status: 404 }));
    return;
  }

  bucket.updatedAt = Date.now();
  event.respondWith(
    new Response(entry.body, {
      headers: {
        "Content-Type": entry.contentType || contentTypeFromPath(assetPath),
        "Content-Security-Policy": PREVIEW_CSP,
        "Cache-Control": "no-store"
      }
    })
  );
});

function pruneExpiredEntries() {
  const now = Date.now();
  for (const [token, bucket] of previewStore.entries()) {
    if (now - bucket.updatedAt > PREVIEW_TTL_MS) {
      previewStore.delete(token);
    }
  }
}

function normalizePath(path) {
  return String(path || "").replace(/^\/+/, "");
}

function contentTypeFromPath(path) {
  if (/\.html?$/i.test(path)) return "text/html";
  if (/\.css$/i.test(path)) return "text/css";
  if (/\.js$/i.test(path)) return "application/javascript";
  if (/\.json$/i.test(path)) return "application/json";
  if (/\.svg$/i.test(path)) return "image/svg+xml";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.webp$/i.test(path)) return "image/webp";
  if (/\.ico$/i.test(path)) return "image/x-icon";
  return "application/octet-stream";
}
