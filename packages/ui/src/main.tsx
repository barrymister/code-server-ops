import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./components/Dashboard.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
