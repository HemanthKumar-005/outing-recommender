"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[nearby] SW registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[nearby] SW registration failed:", err);
        });
    }
  }, []);
  return null;  // renders nothing
}
