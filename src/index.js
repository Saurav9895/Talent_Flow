import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

async function enableMocking() {
  // Enable MSW in all environments for consistent behavior
  const { worker } = await import("./mocks/browser");

  // Initialize the worker
  await worker.start({
    onUnhandledRequest: "bypass", // Don't warn about unhandled requests
    serviceWorker: {
      url: "/mockServiceWorker.js",
    },
  });

  // Auto-seed the database if empty
  const { seedIfEmpty } = await import("./db/init");
  await seedIfEmpty();
}

enableMocking().then(() => {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
