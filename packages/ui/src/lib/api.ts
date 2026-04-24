// Minimal REST client. Password is collected on first auth-needed request
// and cached in sessionStorage (cleared when the tab closes).

const STORAGE_KEY = "csops.password";

export interface ApiError {
  status: number;
  message: string;
}

export class ApiClient {
  constructor(private readonly baseUrl: string = "") {}

  private headers(): HeadersInit {
    const pw = sessionStorage.getItem(STORAGE_KEY);
    if (!pw) return { "content-type": "application/json" };
    return {
      "content-type": "application/json",
      authorization: "Basic " + btoa(`ops:${pw}`),
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401) {
      clearPassword();
      throw {
        status: 401,
        message: "unauthorized — enter the CSOPS password",
      } satisfies ApiError;
    }
    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      const message =
        body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : `${res.status} ${res.statusText}`;
      throw { status: res.status, message } satisfies ApiError;
    }
    return (await res.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  }
}

export function setPassword(pw: string): void {
  sessionStorage.setItem(STORAGE_KEY, pw);
}

export function clearPassword(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasPassword(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) !== null;
}

export const api = new ApiClient();
