/**
 * Frontend entry point.
 *
 * The same bundle serves two windows ("widget" and "settings"). The window
 * role is decided from the URL query string, with a fallback to the Tauri
 * window label so a bare `index.html` still works.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/clock.css";
import "./styles/contrib.css";
import "./styles/settings.css";

type Surface = "widget" | "settings" | "contrib";

function resolveSurface(): Surface {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("window");
  if (fromQuery === "settings") return "settings";
  if (fromQuery === "contrib") return "contrib";
  if (fromQuery === "widget") return "widget";
  // Fallback for direct navigation without a query string.
  if (window.location.hash.includes("contrib")) return "contrib";
  return window.location.hash.includes("settings") ? "settings" : "widget";
}

const surface = resolveSurface();
document.documentElement.dataset.surface = surface;


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App surface={surface} />
  </React.StrictMode>,
);