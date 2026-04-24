// Public library surface — consumed by growth-engine /infrastructure/code-server
// and any other downstream that wants to embed code-server-ops in its admin UI.
//
// Consumers should also import "code-server-ops-ui/styles.css" once.

import "../styles.css";

export { TerminalsPanel } from "../dashboards/Terminals.js";
export { ExtensionsPanel } from "../dashboards/Extensions.js";
export { AiProcessesPanel } from "../dashboards/AiProcesses.js";
export { MemoryTimelinePanel } from "../dashboards/MemoryTimeline.js";
export { LoginGate } from "../components/LoginGate.js";
export { Dashboard } from "../components/Dashboard.js";
export { ApiClient, api, setPassword, clearPassword, hasPassword } from "./api.js";
export type {
  TerminalInfo,
  ExtensionInfo,
  AiProcessInfo,
  MemorySample,
  MemorySnapshot,
  OomEvent,
  TerminalKillPreview,
  ExtensionsGcPreview,
  RestartExtHostPreview,
  AiKillPreview,
} from "./types.js";
