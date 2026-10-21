let access: string | null = null;
let csrf = "";
let renewal: Promise<boolean> | null = null;
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
async function csrfToken() {
  if (!csrf) {
    const response = await fetch("/api/auth/csrf/", {
      credentials: "same-origin",
    });
    if (!response.ok)
      throw new ApiError(
        "No pudimos preparar la sesión. Intenta nuevamente.",
        response.status,
      );
    csrf = (await response.json()).csrfToken;
  }
  return csrf;
}
export async function renew(): Promise<boolean> {
  if (renewal) return renewal;
  renewal = (async () => {
    const response = await fetch("/api/auth/refresh/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRFToken": await csrfToken() },
    });
    if (!response.ok) {
      access = null;
      return false;
    }
    access = (await response.json()).access;
    return true;
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (options.method && !["GET", "HEAD"].includes(options.method))
    headers["X-CSRFToken"] = await csrfToken();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      "No pudimos conectar con Eventia. Comprueba tu conexión e inténtalo de nuevo.",
      0,
    );
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
