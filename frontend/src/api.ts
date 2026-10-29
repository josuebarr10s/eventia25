import { handleFallbackApi } from "./fallbackApi";

let access: string | null = null;
let csrf = "";
let renewal: Promise<boolean> | null = null;
let useFallback = false;

export const setAccess = (value: string | null) => {
  access = value;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

function isJsonResponse(response: Response): boolean {
  const ct = response.headers.get("content-type") || "";
  return ct.includes("application/json");
}

async function csrfToken() {
  if (useFallback) return "fallback-csrf-token";
  if (!csrf) {
    try {
      const response = await fetch("/api/auth/csrf/", {
        credentials: "same-origin",
      });
      if (!response.ok || !isJsonResponse(response)) {
        useFallback = true;
        return "fallback-csrf-token";
      }
      const data = await response.json();
      if (!data?.csrfToken) {
        useFallback = true;
        return "fallback-csrf-token";
      }
      csrf = data.csrfToken;
    } catch {
      useFallback = true;
      return "fallback-csrf-token";
    }
  }
  return csrf;
}

export async function renew(): Promise<boolean> {
  if (renewal) return renewal;
  renewal = (async () => {
    const token = await csrfToken();
    if (useFallback) {
      try {
        const data = await handleFallbackApi<{ access: string }>("/auth/refresh/", {
          method: "POST",
        });
        access = data.access;
        return true;
      } catch {
        access = null;
        return false;
      }
    }
    try {
      const response = await fetch("/api/auth/refresh/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRFToken": token },
      });
      if (response.status >= 500 || (response.status === 404 && !isJsonResponse(response))) {
        useFallback = true;
        const data = await handleFallbackApi<{ access: string }>("/auth/refresh/", {
          method: "POST",
        });
        access = data.access;
        return true;
      }
      if (!response.ok || !isJsonResponse(response)) {
        access = null;
        return false;
      }
      access = (await response.json()).access;
      return true;
    } catch {
      useFallback = true;
      try {
        const data = await handleFallbackApi<{ access: string }>("/auth/refresh/", {
          method: "POST",
        });
        access = data.access;
        return true;
      } catch {
        access = null;
        return false;
      }
    }
  })().finally(() => {
    renewal = null;
  });
  return renewal;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  if (useFallback) {
    return handleFallbackApi<T>(path, options);
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (options.method && !["GET", "HEAD"].includes(options.method)) {
    headers["X-CSRFToken"] = await csrfToken();
    if (useFallback) {
      return handleFallbackApi<T>(path, options);
    }
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    useFallback = true;
    return handleFallbackApi<T>(path, options);
  }
  if (
    response.status >= 500 ||
    (response.status !== 204 && !isJsonResponse(response))
  ) {
    useFallback = true;
    return handleFallbackApi<T>(path, options);
  }
  if (
    response.status === 401 &&
    retry &&
    !path.startsWith("/auth/") &&
    (await renew())
  )
    return api(path, options, false);
  if (response.status === 204) return undefined as T;
  const data = await response
    .json()
    .catch(() => ({
      detail: "No pudimos completar la solicitud. Intenta nuevamente.",
    }));
  if (!response.ok)
    throw new ApiError(
      data.detail || "Ocurrió un error.",
      response.status,
      data.fields || {},
    );
  return data as T;
}
