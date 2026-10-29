import { ApiError } from "./api";
import type { Category, Event, Page, Registration, User } from "./types";

const STORAGE_KEY = "eventia_fallback_state_v1";

const CATEGORIES: Category[] = [
  { value: "culture", label: "Arte y cultura" },
  { value: "music", label: "Música" },
  { value: "technology", label: "Tecnología" },
  { value: "wellness", label: "Bienestar" },
  { value: "community", label: "Comunidad" },
];

const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

type StoredUser = User & { password?: string };
type StoredEvent = Omit<
  Event,
  "registered_count" | "available_spots" | "is_registered" | "can_edit" | "can_publish"
> & {
  organizer_id: number;
};
type StoredRegistration = {
  id: number;
  user_id: number;
  event_id: number;
  created_at: string;
};

type FallbackState = {
  users: StoredUser[];
  events: StoredEvent[];
  registrations: StoredRegistration[];
  currentUserId: number | null;
  nextUserId: number;
  nextEventId: number;
  nextRegId: number;
};

function futureIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function defaultState(): FallbackState {
  const now = new Date().toISOString();
  const organizer: StoredUser = {
    id: 1,
    name: "Equipo Eventia",
    email: "organizador@eventia.demo",
    can_create_events: true,
    can_edit_events: true,
    can_publish_events: true,
  };
  const events: StoredEvent[] = [
    {
      id: 1,
      title: "Ideas que nos conectan",
      description:
        "Un encuentro para explorar la creatividad, compartir ideas y conectar con personas de tu comunidad. Evento de demostración, sin convocatoria real.",
      category: "culture",
      category_label: CATEGORY_MAP.culture,
      starts_at: futureIso(7),
      city: "Ciudad de Guatemala",
      location: "Centro cultural · Zona 4",
      capacity: 40,
      organizer_id: 1,
      organizer_name: organizer.name,
      status: "published",
      created_at: now,
      is_demo: true,
    },
    {
      id: 2,
      title: "Una tarde, muchas canciones",
      description:
        "Una sesión cercana de música y conversación para disfrutar de nuevos sonidos. Evento de demostración, sin convocatoria real.",
      category: "music",
      category_label: CATEGORY_MAP.music,
      starts_at: futureIso(10),
      city: "Ciudad de Guatemala",
      location: "Espacio abierto · Zona 10",
      capacity: 60,
      organizer_id: 1,
      organizer_name: organizer.name,
      status: "published",
      created_at: now,
      is_demo: true,
    },
    {
      id: 3,
      title: "Construyamos algo juntos",
      description:
        "Un taller para intercambiar experiencias y descubrir nuevas formas de crear con tecnología. Evento de demostración, sin convocatoria real.",
      category: "technology",
      category_label: CATEGORY_MAP.technology,
      starts_at: futureIso(13),
      city: "Ciudad de Guatemala",
      location: "Laboratorio creativo · Zona 14",
      capacity: 24,
      organizer_id: 1,
      organizer_name: organizer.name,
      status: "published",
      created_at: now,
      is_demo: true,
    },
  ];
  return {
    users: [organizer],
    events,
    registrations: [],
    currentUserId: null,
    nextUserId: 2,
    nextEventId: 4,
    nextRegId: 1,
  };
}

function loadState(): FallbackState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as FallbackState;
    }
  } catch {
    // ignore storage errors
  }
  const initial = defaultState();
  saveState(initial);
  return initial;
}

function saveState(state: FallbackState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function hydrateEvent(state: FallbackState, ev: StoredEvent): Event {
  const registered_count = state.registrations.filter(
    (r) => r.event_id === ev.id,
  ).length;
  const available_spots = Math.max(0, ev.capacity - registered_count);
  const is_registered =
    state.currentUserId != null &&
    state.registrations.some(
      (r) => r.event_id === ev.id && r.user_id === state.currentUserId,
    );
  const currentUser = state.users.find((u) => u.id === state.currentUserId);
  const isOwner =
    currentUser != null &&
    (ev.organizer_id === currentUser.id || currentUser.can_edit_events);
  return {
    ...ev,
    category_label: CATEGORY_MAP[ev.category] || ev.category,
    registered_count,
    available_spots,
    is_registered,
    can_edit: Boolean(isOwner),
    can_publish: Boolean(isOwner),
  };
}

function paginate<T>(items: T[], page: number, pageSize = 12): Page<T> {
  const start = (page - 1) * pageSize;
  const results = items.slice(start, start + pageSize);
  return {
    count: items.length,
    next: start + pageSize < items.length ? String(page + 1) : null,
    previous: page > 1 ? String(page - 1) : null,
    results,
  };
}

export async function handleFallbackApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const state = loadState();
  const method = (options.method || "GET").toUpperCase();
  const url = new URL(path, "http://localhost");
  const pathname = url.pathname;
  const body =
    typeof options.body === "string" && options.body
      ? JSON.parse(options.body)
      : {};

  if (pathname === "/auth/csrf/") {
    return { csrfToken: "fallback-csrf-token" } as T;
  }

  if (pathname === "/auth/refresh/" && method === "POST") {
    const user = state.users.find((u) => u.id === state.currentUserId);
    if (!user) throw new ApiError("Inicia sesión para continuar.", 401);
    return { access: `fallback-jwt-${user.id}` } as T;
  }

  if (pathname === "/auth/logout/" && method === "POST") {
    state.currentUserId = null;
    saveState(state);
    return undefined as T;
  }

  if (pathname === "/auth/register/" && method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim() || email.split("@")[0] || "Participante";
    const password = String(body.password || "");
    if (!email || !email.includes("@")) {
      throw new ApiError("Revisa los campos del formulario.", 400, {
        email: ["Ingresa un correo electrónico válido."],
      });
    }
    if (password.length < 10) {
      throw new ApiError("Revisa los campos del formulario.", 400, {
        password: ["La contraseña debe tener al menos 10 caracteres."],
      });
    }
    let user = state.users.find((u) => u.email.toLowerCase() === email);
    if (user) {
      throw new ApiError("Revisa los campos del formulario.", 400, {
        email: ["Ya existe una cuenta con este correo."],
      });
    }
    user = {
      id: state.nextUserId++,
      name,
      email,
      password,
      can_create_events: true,
      can_edit_events: true,
      can_publish_events: true,
    };
    state.users.push(user);
    state.currentUserId = user.id;
    saveState(state);
    const { password: _, ...publicUser } = user;
    return { access: `fallback-jwt-${user.id}`, user: publicUser } as T;
  }

  if (pathname === "/auth/login/" && method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      throw new ApiError("Correo o contraseña incorrectos.", 401);
    }
    let user = state.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      user = {
        id: state.nextUserId++,
        name: email.split("@")[0] || "Usuario Eventia",
        email,
        password,
        can_create_events: true,
        can_edit_events: true,
        can_publish_events: true,
      };
      state.users.push(user);
    } else if (user.password && user.password !== password) {
      throw new ApiError("Correo o contraseña incorrectos.", 401);
    }
    state.currentUserId = user.id;
    saveState(state);
    const { password: _, ...publicUser } = user;
    return { access: `fallback-jwt-${user.id}`, user: publicUser } as T;
  }

  if (pathname === "/users/me/" && method === "GET") {
    const user = state.users.find((u) => u.id === state.currentUserId);
    if (!user) throw new ApiError("Inicia sesión para continuar.", 401);
    const { password: _, ...publicUser } = user;
    return publicUser as T;
  }

  if (pathname === "/events/categories/" && method === "GET") {
    return CATEGORIES as T;
  }

  if (pathname === "/events/mine/" && method === "GET") {
    const user = state.users.find((u) => u.id === state.currentUserId);
    if (!user) throw new ApiError("Inicia sesión para continuar.", 401);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const mine = state.events
      .filter((e) => e.organizer_id === user.id || e.is_demo)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((e) => hydrateEvent(state, e));
    return paginate(mine, page) as T;
  }

  if (pathname === "/events/" && method === "GET") {
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const category = (url.searchParams.get("category") || "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const filtered = state.events
      .filter((e) => e.status === "published")
      .filter((e) => !category || e.category === category)
      .filter(
        (e) =>
          !search ||
          e.title.toLowerCase().includes(search) ||
          e.description.toLowerCase().includes(search) ||
          e.city.toLowerCase().includes(search),
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((e) => hydrateEvent(state, e));
    return paginate(filtered, page) as T;
  }

  if (pathname === "/events/" && method === "POST") {
    const user = state.users.find((u) => u.id === state.currentUserId);
    if (!user) throw new ApiError("Inicia sesión para continuar.", 401);
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "culture");
    const starts_at = String(body.starts_at || futureIso(7));
    const city = String(body.city || "Ciudad de Guatemala").trim();
    const location = String(body.location || "").trim();
    const capacity = Math.max(1, Number(body.capacity) || 30);
    if (!title || !description || !location) {
      throw new ApiError("Completa todos los campos obligatorios.", 400);
    }
    const created: StoredEvent = {
      id: state.nextEventId++,
      title,
      description,
      category,
      category_label: CATEGORY_MAP[category] || category,
      starts_at,
      city,
      location,
      capacity,
      organizer_id: user.id,
      organizer_name: user.name,
      status: "draft",
      created_at: new Date().toISOString(),
      is_demo: false,
    };
    state.events.push(created);
    saveState(state);
    return hydrateEvent(state, created) as T;
  }

  const publishMatch = pathname.match(/^\/events\/(\d+)\/publish\/$/);
  if (publishMatch && method === "POST") {
    const id = Number(publishMatch[1]);
    const ev = state.events.find((e) => e.id === id);
    if (!ev) throw new ApiError("Evento no encontrado.", 404);
    ev.status = "published";
    saveState(state);
    return hydrateEvent(state, ev) as T;
  }

  const eventMatch = pathname.match(/^\/events\/(\d+)\/$/);
  if (eventMatch) {
    const id = Number(eventMatch[1]);
    const ev = state.events.find((e) => e.id === id);
    if (!ev) throw new ApiError("Evento no encontrado.", 404);
    if (method === "GET") {
      return hydrateEvent(state, ev) as T;
    }
    if (method === "PATCH") {
      if (body.title !== undefined) ev.title = String(body.title).trim();
      if (body.description !== undefined)
        ev.description = String(body.description).trim();
      if (body.category !== undefined) {
        ev.category = String(body.category);
        ev.category_label = CATEGORY_MAP[ev.category] || ev.category;
      }
      if (body.starts_at !== undefined) ev.starts_at = String(body.starts_at);
      if (body.city !== undefined) ev.city = String(body.city).trim();
      if (body.location !== undefined) ev.location = String(body.location).trim();
      if (body.capacity !== undefined)
        ev.capacity = Math.max(1, Number(body.capacity) || ev.capacity);
      saveState(state);
      return hydrateEvent(state, ev) as T;
    }
  }

  if (pathname === "/registrations/" && method === "GET") {
    const user = state.users.find((u) => u.id === state.currentUserId);
    if (!user) throw new ApiError("Inicia sesión para continuar.", 401);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const regs: Registration[] = state.registrations
      .filter((r) => r.user_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => {
        const ev = state.events.find((e) => e.id === r.event_id)!;
        return {
          id: r.id,
          event: hydrateEvent(state, ev),
          created_at: r.created_at,
          status: "confirmed",
          notification_status: "console",
        };
      });
    return paginate(regs, page) as T;
  }

  if (pathname === "/registrations/" && method === "POST") {
    const user = state.users.find((u) => u.id === state.currentUserId);
    if (!user) throw new ApiError("Inicia sesión para continuar.", 401);
    const eventId = Number(body.event_id);
    const ev = state.events.find((e) => e.id === eventId);
    if (!ev) throw new ApiError("Evento no encontrado.", 404);
    const exists = state.registrations.some(
      (r) => r.user_id === user.id && r.event_id === eventId,
    );
    if (exists) {
      throw new ApiError("Ya tienes una inscripción en este evento.", 400);
    }
    const count = state.registrations.filter((r) => r.event_id === eventId).length;
    if (count >= ev.capacity) {
      throw new ApiError("Este evento ya no tiene cupos disponibles.", 400);
    }
    const reg: StoredRegistration = {
      id: state.nextRegId++,
      user_id: user.id,
      event_id: eventId,
      created_at: new Date().toISOString(),
    };
    state.registrations.push(reg);
    saveState(state);
    return {
      id: reg.id,
      event: hydrateEvent(state, ev),
      created_at: reg.created_at,
      status: "confirmed",
      notification_status: "console",
    } as T;
  }

  throw new ApiError("Ruta no encontrada.", 404);
}

