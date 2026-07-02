"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) {
            console.log("Service Workers are not supported in this browser.");
            return;
        }

        navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((registration) => {
                console.log("Service Worker registered successfully:", registration);
                registration.update().catch(() => {
                    // Update checks can fail offline; the next page load will retry.
                });

                if (registration.waiting) {
                    registration.waiting.postMessage({ type: "SKIP_WAITING" });
                }

                registration.addEventListener("updatefound", () => {
                    const worker = registration.installing;
                    if (!worker) return;

                    worker.addEventListener("statechange", () => {
                        if (worker.state === "installed" && navigator.serviceWorker.controller) {
                            worker.postMessage({ type: "SKIP_WAITING" });
                        }
                    });
                });
            })
            .catch((error) => {
                console.error("Service Worker registration failed:", error);
            });

        let hasReloadedForController = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (hasReloadedForController) return;
            hasReloadedForController = true;
            window.location.reload();
        });
    }, []);

    return null;
}
