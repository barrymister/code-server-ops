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
