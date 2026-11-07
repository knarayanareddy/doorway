/**
 * The real loader, injected the way a platform's page would include it. Nothing here re-implements the
 * Door: window.doorway is the loader from /dist/latest on this same origin, and it talks to the Door origin
 * it was built with. If it is not there, the Live tab says so and does nothing else.
 */

export type DoorwayStatus = "loading" | "ready" | "missing";

export interface DoorwayApi {
  trigger(type: string, opts?: { preview?: string }): Promise<void>;
}

declare global {
  interface Window {
    doorway?: DoorwayApi;
  }
}

export const LOADER_SRC = "/dist/latest/doorway.min.js";

/** The install's settings, as the script tag carries them. The Live tab shows these; it cannot change them. */
export const INSTALL = Object.freeze({
  install: "inst_demo001",
  country: "NL",
  legalJurisdiction: "NL",
  labs: "fork,wave,preview,advance",
  waveSeconds: "15",
});

let pending: Promise<boolean> | null = null;

/** Injects the real loader once per page. Resolves true when window.doorway exists, false when the script did not load. */
export function loadDoorway(): Promise<boolean> {
  if (window.doorway) return Promise.resolve(true);
  pending ??= new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = LOADER_SRC;
    s.defer = true;
    s.dataset.install = INSTALL.install;
    s.dataset.country = INSTALL.country;
    s.dataset.legalJurisdiction = INSTALL.legalJurisdiction;
    s.dataset.labs = INSTALL.labs;
    s.dataset.waveSeconds = INSTALL.waveSeconds;
    s.onload = () => resolve(!!window.doorway);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return pending;
}
