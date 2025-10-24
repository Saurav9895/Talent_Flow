import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

// Expose worker on window for debugging purposes
window.msw = { worker };

// Initialize the worker
worker.start({
  onUnhandledRequest: "bypass", // Don't warn about unhandled requests
  serviceWorker: {
    url: "/mockServiceWorker.js",
  },
});
