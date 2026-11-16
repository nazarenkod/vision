import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { RouteError } from "./components/RouteError";
import { BRAND } from "./constants/brand";

document.title = BRAND.name;

// Global styles to override some defaults
import "./index.css";

// Fonts ship with the app: the server may have no way out to a font CDN.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
// only the wordmark is set in Geist
import "@fontsource/geist-sans/700.css";

// A data router, so a page can hold the user back while it has unsaved
// changes (useBlocker). The routes themselves stay in <Routes> inside App.
const router = createBrowserRouter([
  { path: "*", element: <App />, errorElement: <RouteError /> },
]);

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
