import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  MapPin,
  Music2,
  Palette,
  Sparkles,
  Users,
  Cpu,
  Leaf,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Event } from "./types";

export const date = (
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
) =>
  new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    ...options,
  }).format(new Date(value));
export function CategoryIcon({
  category,
  size = 24,
}: {
  category: string;
  size?: number;
}) {
  const Icon =
    (
      {
        music: Music2,
        culture: Palette,
        technology: Cpu,
        wellness: Leaf,
        community: Users,
      } as Record<string, typeof Music2>
    )[category] || Sparkles;
  return <Icon size={size} aria-hidden="true" strokeWidth={1.6} />;
}
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Eventia, inicio">
      <span className="brand-mark" aria-hidden="true">
        e<span />
      </span>
      eventia<span className="brand-dot">.</span>
    </Link>
  );
}
export function Badge({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <span className={`badge ${warning ? "badge-warning" : ""}`}>
      {children}
    </span>
  );
}
export function Alert({
  children,
  kind = "error",
}: {
  children: ReactNode;
  kind?: "error" | "success" | "info";
}) {
  return (
    <div
      className={`alert alert-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {kind === "success" ? (
        <Check size={20} aria-hidden="true" />
      ) : (
        <CircleAlert size={20} aria-hidden="true" />
      )}
      <div>{children}</div>
    </div>
  );
}
export function Loading({
  label = "Buscando buenos planes…",
}: {
  label?: string;
}) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ArrowDownLeft size={32} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="error-state">
      <Alert>{error.message}</Alert>
      <button className="button secondary" onClick={retry}>
        Reintentar
      </button>
    </div>
  );
}
export function Field({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  error?: string[] | string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field ${error ? "field-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <small id={`${id}-hint`} className="muted">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className="field-message">
          {Array.isArray(error) ? error.join(" ") : error}
        </small>
      )}
    </div>
  );
}
export function EventRow({ event }: { event: Event }) {
  return (
    <article className="event-row">
      <div className={`event-art art-${event.category}`}>
        <CategoryIcon category={event.category} size={34} />
        <span className="art-ring" />
      </div>
      <div className="event-row-content">
        <div className="event-topline">
          <span className="eyebrow">{event.category_label}</span>
          {event.is_demo && <Badge>Demostración</Badge>}
          {event.status === "draft" && <Badge warning>Borrador</Badge>}
        </div>
        <h3>
          <Link to={`/events/${event.id}`}>{event.title}</Link>
        </h3>
        <div className="event-meta">
          <span>
            <CalendarDays size={15} aria-hidden="true" />
            {date(event.starts_at, { day: "numeric", month: "short" })} ·{" "}
            {date(event.starts_at, { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span>
            <MapPin size={15} aria-hidden="true" />
            {event.city}
          </span>
        </div>
      </div>
      <div className="event-row-action">
        <span className="small muted">
          {event.available_spots > 0
            ? `${event.available_spots} cupos disponibles`
            : "Sin cupos"}
          {event.is_registered && " · Ya estás inscrito"}
        </span>
        <Link className="text-link" to={`/events/${event.id}`}>
          Ver evento <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Cerrar confirmación"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pagination({
  count,
  page,
  onPage,
}: {
  count: number;
  page: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.ceil(count / 12);
  if (pages < 2) return null;
  return (
    <nav className="pagination" aria-label="Paginación">
      <button
        className="button secondary small-button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </button>
      <span className="small">
        Página {page} de {pages}
      </span>
      <button
        className="button secondary small-button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
