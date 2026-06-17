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
            })
            .catch((error) => {
                console.error("Service Worker registration failed:", error);
            });
    }, []);

    return null;
}
