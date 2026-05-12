import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./app/app";

// Side-effect import: instantiates Electroview + opens the bun ↔ webview
// RPC socket before any component tries to call `dbRpc.request(...)`.
import "./lib/db-rpc";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
