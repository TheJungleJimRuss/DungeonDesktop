import { useSyncExternalStore } from "react";

/** Service worker registration and the "update available" state. Production builds only:
 *  the dev server and unit tests never register a worker. */
let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setWaitingWorker(worker: ServiceWorker | null) {
  waiting = worker;
  emit();
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => waiting !== null,
  );
}

/** Ask the waiting worker to take over; the page reloads once it has (see registerServiceWorker). */
export function applyUpdate() {
  waiting?.postMessage({ type: "SKIP_WAITING" });
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker;
  let controlled = !!sw.controller;
  let reloading = false;
  sw.addEventListener("controllerchange", () => {
    // First install claims the page without a reload; only reload for an accepted update.
    if (!controlled) {
      controlled = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  sw.register("/sw.js").then((reg) => {
    const check = () => {
      if (reg.waiting && sw.controller) setWaitingWorker(reg.waiting);
    };
    check();
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      worker?.addEventListener("statechange", () => worker.state === "installed" && check());
    });
  });
}
