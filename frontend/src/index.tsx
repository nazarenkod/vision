import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { BRAND } from "./constants/brand";

document.title = BRAND.name;

// Global styles to override some defaults
import "./index.css";

// Interface font
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

// A data router only so pages can hold navigation back (unsaved settings);
// the routes themselves stay in Router.jsx
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
