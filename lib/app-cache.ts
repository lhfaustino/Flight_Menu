"use client";

const APP_CACHE_PREFIXES = ["trip-space-", "workbox-", "next-pwa-"];

export async function clearAppRuntimeCaches() {
  if (typeof window === "undefined") return;

  const cacheClear =
    "caches" in window
      ? caches
          .keys()
          .then((names) =>
            Promise.all(
              names
                .filter((name) => APP_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
                .map((name) => caches.delete(name)),
            ),
          )
          .catch(() => undefined)
      : Promise.resolve();

  const controller = navigator.serviceWorker?.controller;
  if (controller) {
    controller.postMessage({ type: "CLEAR_APP_CACHES" });
  }

  await cacheClear;
}
