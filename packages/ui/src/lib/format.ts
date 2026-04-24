export function formatKb(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const leftover = mins - hours * 60;
    return leftover > 0 ? `${hours}h ${leftover}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const leftoverHours = hours - days * 24;
  return leftoverHours > 0 ? `${days}d ${leftoverHours}h` : `${days}d`;
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return iso;
  }
}
