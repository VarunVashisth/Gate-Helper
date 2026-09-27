export type PlatformMode = "web" | "desktop";

export interface PlatformInfo {
  mode: PlatformMode;
  ollama_available: boolean;
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("The GATE Helper backend is not reachable.");
  }

  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}.`, response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getPlatform: () => request<PlatformInfo>("/api/platform"),
};

