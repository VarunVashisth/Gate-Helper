export type PlatformMode = "web" | "desktop";

export interface PlatformInfo {
  mode: PlatformMode;
  ollama_available: boolean;
}

export interface SyllabusTopic {
  id: string;
  name: string;
  completed: boolean;
  subtopics: SyllabusTopic[];
}

export interface SyllabusDocument {
  topics: SyllabusTopic[];
  progress: { completed: number; total: number; percentage: number };
}

export interface SyllabusImportPreview {
  title: string;
  topics: SyllabusTopic[];
  warnings: string[];
  page_count: number;
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
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("The GATE Helper backend is not reachable.");
  }

  if (!response.ok) {
    let message = `API request failed with status ${response.status}.`;
    try {
      const payload = await response.json() as { detail?: string };
      if (payload.detail) message = payload.detail;
    } catch { /* The response did not contain JSON error details. */ }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getPlatform: () => request<PlatformInfo>("/api/platform"),
  getSyllabus: () => request<SyllabusDocument>("/api/syllabus"),
  importSyllabus: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<SyllabusImportPreview>("/api/syllabus/import", { method: "POST", body });
  },
  saveSyllabus: (topics: SyllabusTopic[]) => request<SyllabusDocument>("/api/syllabus", {
    method: "PUT",
    body: JSON.stringify({ topics }),
  }),
  updateTopicProgress: (topicId: string, completed: boolean) => request<SyllabusDocument>(`/api/syllabus/topics/${topicId}`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  }),
};

