// Shared types — hand-mirrored from the agent's public API contract.
// Future: publish @code-server-ops/types from the agent and import directly.

export interface TerminalInfo {
  pid: number;
  lstart: string;
  ageSeconds: number;
  rssKb: number;
  ptyHostPid: number | null;
  attached: boolean;
  cwd: string | null;
}

export interface ExtensionInfo {
  name: string;
  version: string;
  sizeKb: number;
  registered: boolean;
  orphan: boolean;
  multiVersionPeers: string[];
}

export interface AiProcessInfo {
  pid: number;
  extension: string;
  conversationId: string | null;
  uptimeSeconds: number;
  rssKb: number;
  extensionHostPid: number | null;
}

export interface MemorySample {
  timestamp: string;
  extHostPid: number | null;
  rssKb: number;
  heapUsedKb: number | null;
}

export interface MemorySnapshot {
  current: MemorySample;
  series: MemorySample[];
}

export interface OomEvent {
  timestamp: string;
  pid: number;
  comm: string;
  containerHint: string | null;
}

export interface TerminalKillPreview {
  token: string;
  plan: Array<{
    pid: number;
    lstart: string;
    ageSeconds: number;
    rssKb: number;
    attached: boolean;
    cwd: string | null;
  }>;
  ttlSeconds: number;
}

export interface ExtensionsGcPreview {
  token: string;
  plan: Array<{
    folderName: string;
    name: string;
    version: string;
    sizeKb: number;
    absolutePath: string;
  }>;
  reclaimableKb: number;
  ttlSeconds: number;
}

export interface RestartExtHostPreview {
  token: string;
  plan: {
    extHostPid: number;
    rssKb: number;
  };
  ttlSeconds: number;
}

export interface AiKillPreview {
  token: string;
  plan: Array<{
    pid: number;
    extension: string;
    uptimeSeconds: number;
    rssKb: number;
  }>;
  ttlSeconds: number;
}
