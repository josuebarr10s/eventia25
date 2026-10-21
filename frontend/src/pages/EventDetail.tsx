import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  MapPin,
  Ticket,
  Users,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Alert,
  Badge,
  CategoryIcon,
  date,
  ErrorState,
  Loading,
} from "../components";
import { useResource } from "../hooks/useResource";
import type { Event, Registration } from "../types";

export function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const {
    data: event,
    error,
    loading,
    reload,
  } = useResource<Event>(`/events/${id}/`);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState("");
  useEffect(() => {
    setNotice("");
    setFailure("");
  }, [id]);
  async function register() {
    setBusy(true);
    setFailure("");
    try {
      const result = await api<Registration>("/registrations/", {
        method: "POST",
        body: JSON.stringify({ event_id: Number(id) }),
      });
      setNotice(
        result.notification_status === "console"
          ? "Inscripción confirmada. La confirmación de correo se generó en la consola de desarrollo."
          : result.notification_status === "failed"
            ? "Inscripción confirmada. No pudimos enviar el correo; tu lugar está reservado."
            : "Inscripción confirmada. Tu lugar está reservado.",
      );
      reload();
    } catch (err) {
      setFailure((err as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  }
  if (loading && !event)
    return (
      <div className="container">
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="container page">
        <h1 tabIndex={-1}>No pudimos abrir este evento</h1>
        <ErrorState error={error} retry={reload} />
        <Link className="text-link" to="/explore">
          Volver a explorar <ArrowRight size={18} />
        </Link>
      </div>
    );
  if (!event) return null;
  const past = new Date(event.starts_at) <= new Date();
  return (
    <div className="container page event-detail">
      <Link className="breadcrumb" to="/explore">
        Explorar eventos <ChevronRight size={15} />{" "}
        <span>{event.category_label}</span>
      </Link>
      <div className={`detail-banner art-${event.category}`}>
        <CategoryIcon category={event.category} size={80} />
        <span className="banner-title">
          Hagamos que pase<span>✳</span>
        </span>
        <span className="banner-orbit" />
      </div>
      <div className="detail-grid">
        <div>
          <div className="event-topline">
            <span className="eyebrow">{event.category_label}</span>
            {event.is_demo && <Badge>Demostración</Badge>}
            {event.status === "draft" && (
              <Badge warning>
                Borrador · solo visible para organizadores autorizados
              </Badge>
            )}
          </div>
          <h1 tabIndex={-1}>{event.title}</h1>
          <p className="muted organizer-line">
            Un encuentro de <strong>{event.organizer_name}</strong>
          </p>
          <div className="detail-facts">
            <div>
              <CalendarDays />
              <p>
                <strong>{date(event.starts_at)}</strong>
                <span>
                  {date(event.starts_at, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · America/Guatemala
                </span>
              </p>
            </div>
            <div>
              <MapPin />
              <p>
                <strong>{event.location}</strong>
                <span>{event.city}</span>
              </p>
            </div>
          </div>
          <section className="description">
            <h2>De qué se trata</h2>
            <p>{event.description}</p>
          </section>
          <div className="small muted inline-icon">
            <Users size={18} /> Capacidad total: {event.capacity} personas
          </div>
          {event.can_edit && (
            <Link
              to={`/manage/${event.id}/edit`}
              className="button secondary edit-link"
            >
              Editar evento <ArrowUpRight size={18} />
            </Link>
          )}
        </div>
        <aside className="registration-panel">
          <Ticket size={28} aria-hidden="true" />
          <h2>Tu lugar, tu próximo recuerdo.</h2>
          <p className="muted">
            {event.is_registered
              ? "Ya eres parte de este encuentro."
              : past
                ? "Este encuentro ya comenzó."
                : event.status === "draft"
                  ? "Este evento aún no está publicado."
                  : "Un buen plan empieza por estar ahí."}
          </p>
          <div className="capacity-line">
            <strong>{event.available_spots}</strong>
            <span>de {event.capacity} cupos disponibles</span>
          </div>
          <progress
            value={event.available_spots}
            max={event.capacity}
            aria-label={`${event.available_spots} cupos disponibles de ${event.capacity}`}
          />
          {notice && <Alert kind="success">{notice}</Alert>}
          {failure && <Alert>{failure}</Alert>}
          {event.is_registered ? (
            <>
              <Badge>
                <Check size={14} /> Inscripción confirmada
              </Badge>
              <Link className="button secondary full-width" to="/registrations">
                Ver mi inscripción <ArrowUpRight size={18} />
              </Link>
            </>
          ) : past ||
            event.available_spots === 0 ||
            event.status === "draft" ? (
            <button className="button primary full-width" disabled>
              {past
                ? "Evento finalizado"
                : event.status === "draft"
                  ? "Pendiente de publicación"
                  : "Sin cupos"}
            </button>
          ) : user ? (
            <button
              className="button primary full-width"
              onClick={register}
              disabled={busy}
            >
              {busy ? "Confirmando inscripción…" : "Inscribirme"}
              <ArrowUpRight size={19} />
            </button>
          ) : (
            <Link
              className="button primary full-width"
              to={`/login?next=/events/${event.id}`}
            >
              Inicia sesión para inscribirte <ArrowUpRight size={18} />
            </Link>
          )}
          <p className="caption muted">
            Una inscripción por persona. Los cupos se confirman al completar el
            registro.
          </p>
        </aside>
      </div>
    </div>
  );
}
