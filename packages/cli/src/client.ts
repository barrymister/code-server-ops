export interface ClientConfig {
  url: string;
  password: string;
}

export function readConfig(): ClientConfig {
  const url = process.env.CSOPS_URL ?? "http://localhost:4242";
  const password = process.env.CSOPS_PASSWORD;
  if (!password) {
    throw new Error(
      "CSOPS_PASSWORD env var is required. Set it to the agent's basic-auth password.",
    );
  }
  return { url, password };
}

function authHeader(password: string): string {
  return "Basic " + Buffer.from(`ops:${password}`).toString("base64");
}

export async function get<T>(pathname: string): Promise<T> {
  const { url, password } = readConfig();
  const res = await fetch(`${url.replace(/\/$/, "")}${pathname}`, {
    headers: { authorization: authHeader(password) },
  });
  if (!res.ok) {
    throw new Error(`GET ${pathname} — ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function post<T>(pathname: string, body: unknown): Promise<T> {
  const { url, password } = readConfig();
  const res = await fetch(`${url.replace(/\/$/, "")}${pathname}`, {
    method: "POST",
    headers: {
      authorization: authHeader(password),
      "content-type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      if (j && typeof j === "object" && "error" in j) {
        detail = ` — ${String((j as { error: unknown }).error)}`;
      }
    } catch {
      // ignore
    }
    throw new Error(`POST ${pathname} — ${res.status} ${res.statusText}${detail}`);
  }
  return (await res.json()) as T;
}
