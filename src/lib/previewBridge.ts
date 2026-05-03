export type PreviewEntry = {
  path: string;
  body: ArrayBuffer;
  contentType: string;
};

export type PublishedPreview = {
  token: string;
  url: string;
};

export async function publishPreviewEntries(entries: PreviewEntry[]): Promise<PublishedPreview> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Runtime preview requires Service Worker support.");
  }
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active || navigator.serviceWorker.controller;
  if (!worker) {
    throw new Error("Runtime preview service worker is not ready.");
  }
  const token = crypto.randomUUID();
  const channel = new MessageChannel();
  const ready = new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("Runtime preview publish timed out."));
    }, 5000);
    channel.port1.onmessage = (event) => {
      if (event.data?.type === "preview:ready" && event.data?.token === token) {
        window.clearTimeout(timeoutId);
        channel.port1.close();
        resolve();
      }
    };
  });
  worker.postMessage({
    type: "preview:publish",
    token,
    entries
  }, [channel.port2]);
  await ready;
  return {
    token,
    url: `/preview/${token}/index.html`
  };
}

export async function evictPreviewEntries(token: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active || navigator.serviceWorker.controller;
  worker?.postMessage({ type: "preview:evict", token });
}
