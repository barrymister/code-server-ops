export function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h${Math.floor((secs % 3600) / 60)}m`;
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  return `${days}d${hours}h`;
}

export function formatKb(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function parseDuration(input: string): number {
  const m = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) throw new Error(`Invalid duration: ${input}. Expected e.g. 30m, 24h, 7d.`);
  const n = Number.parseInt(m[1]!, 10);
  const unit = (m[2] ?? "s").toLowerCase();
  switch (unit) {
    case "s":
      return n;
    case "m":
      return n * 60;
    case "h":
      return n * 3600;
    case "d":
      return n * 86400;
    default:
      throw new Error(`Invalid unit: ${unit}`);
  }
}
