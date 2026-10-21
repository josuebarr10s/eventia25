import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { ArrowUpRight, Check, ChevronRight, Clock3 } from "lucide-react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { Alert, ErrorState, Field, Loading, Modal } from "../components";
import { useResource } from "../hooks/useResource";
import type { Category, Event } from "../types";

const emptyForm = {
  title: "",
  description: "",
  category: "culture",
  starts_at: "",
  city: "",
  location: "",
  capacity: "30",
};
function localDate(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 16);
}
export function EventForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const editing = !!id;
  const categories = useResource<Category[]>("/events/categories/");
  const [values, setValues] = useState(emptyForm),
    [original, setOriginal] = useState(JSON.stringify(emptyForm)),
    [loading, setLoading] = useState(editing),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiError | null>(null),
    [saved, setSaved] = useState<Event | null>(null);
  const dirty = JSON.stringify(values) !== original && !saved;
  const blocker = useBlocker(dirty && !busy);
  useEffect(() => {
    let active = true;
    if (id) {
      setLoading(true);
      api<Event>(`/events/${id}/`)
        .then((event) => {
          if (!active) return;
          if (!event.can_edit)
            throw new ApiError(
              "No tienes permiso para editar este evento.",
              403,
            );
          const data = {
            title: event.title,
            description: event.description,
            category: event.category,
            starts_at: localDate(event.starts_at),
            city: event.city,
            location: event.location,
            capacity: String(event.capacity),
          };
          setValues(data);
          setOriginal(JSON.stringify(data));
        })
        .catch((err) => {
          if (active) setError(err);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function update(key: keyof typeof emptyForm, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<Event>(editing ? `/events/${id}/` : "/events/", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...values,
          capacity: Number(values.capacity),
          starts_at: new Date(`${values.starts_at}:00-06:00`).toISOString(),
        }),
      });
      setSaved(data);
    } catch (err) {
      setError(err as ApiError);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('[role="alert"]')
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
    } finally {
      setBusy(false);
    }
  }
  if (!editing && !user?.can_create_events)
    return (
      <div className="container page">
        <h1>No tienes permiso para crear eventos.</h1>
        <Link to="/manage">Volver a mis eventos</Link>
      </div>
    );
  if (loading)
    return (
      <div className="container">
        <Loading label="Preparando el formulario…" />
      </div>
    );
  if (saved)
    return (
      <div className="container page saved-page">
        <span className="success-mark">
          <Check size={38} />
        </span>
        <p className="eyebrow">Una idea más cerca de pasar</p>
        <h1 tabIndex={-1}>
          {editing ? "Cambios guardados." : "Tu borrador está listo."}
        </h1>
        <p className="muted">
          {saved.title}
          {saved.status === "draft"
            ? " aún no es público. Puedes publicarlo desde Mis eventos."
            : " sigue publicado con la información actualizada."}
        </p>
        <div className="inline-actions">
          <Link className="button primary" to="/manage">
            Ir a mis eventos <ArrowUpRight size={18} />
          </Link>
          <Link className="button secondary" to={`/events/${saved.id}`}>
            Ver evento
          </Link>
        </div>
      </div>
    );
  if (error && [403, 404].includes(error.status))
    return (
      <div className="container page">
        <h1>Este evento no está disponible</h1>
        <Alert>{error.message}</Alert>
        <Link to="/manage">Volver a mis eventos</Link>
      </div>
    );
  const field = (key: keyof typeof emptyForm) => ({
    id: key,
    name: key,
    value: values[key],
    onChange: (
      e: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => update(key, e.target.value),
    required: true,
    "aria-invalid": !!error?.fields[key],
    "aria-describedby": error?.fields[key]
      ? `${key}-error`
      : ["description", "starts_at", "capacity"].includes(key)
        ? `${key}-hint`
        : undefined,
  });
  return (
    <div className="container page form-page">
      <Link className="breadcrumb" to="/manage">
        Mis eventos <ChevronRight size={15} />
        <span>{editing ? "Editar" : "Nuevo evento"}</span>
      </Link>
      <div className="page-heading">
        <p className="eyebrow">Crea algo que nos reúna</p>
        <h1 tabIndex={-1}>
          {editing ? "Afina los detalles." : "Todo empieza con una idea."}
        </h1>
        <p className="muted">
          {editing
            ? "Actualiza la información de tu encuentro."
            : "Completa los detalles y guarda tu primer borrador."}
        </p>
      </div>
      <form className="event-form" onSubmit={submit}>
        {error && <Alert>{error.message}</Alert>}
        <fieldset>
          <legend>
            <span>01</span> La idea
          </legend>
          <Field
            label="Nombre del evento"
            id="title"
            error={error?.fields.title}
          >
            <input
              {...field("title")}
              maxLength={180}
              placeholder="Un nombre que invite a ser parte"
            />
          </Field>
          <Field
            label="Descripción"
            id="description"
            error={error?.fields.description}
            hint="Cuéntanos qué pasará y qué deben saber los asistentes. Máximo 10 000 caracteres."
          >
            <textarea {...field("description")} maxLength={10000} rows={5} />
          </Field>
          <Field label="Categoría" id="category" error={error?.fields.category}>
            <select {...field("category")} disabled={categories.loading}>
              {categories.data?.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {categories.error && (
            <ErrorState error={categories.error} retry={categories.reload} />
          )}
        </fieldset>
        <fieldset>
          <legend>
            <span>02</span> Cuándo y dónde
          </legend>
          <div className="form-grid">
            <Field
              label="Fecha y hora"
              id="starts_at"
              error={error?.fields.starts_at}
              hint="Zona horaria: America/Guatemala (UTC−6)."
            >
              <input
                {...field("starts_at")}
                type="datetime-local"
                min={localDate(new Date().toISOString())}
              />
            </Field>
            <Field label="Ciudad" id="city" error={error?.fields.city}>
              <input
                {...field("city")}
                maxLength={120}
                autoComplete="address-level2"
              />
            </Field>
          </div>
          <Field
            label="Lugar o dirección"
            id="location"
            error={error?.fields.location}
          >
            <input
              {...field("location")}
              maxLength={255}
              placeholder="Incluye la información necesaria para llegar"
            />
          </Field>
        </fieldset>
        <fieldset>
          <legend>
            <span>03</span> Un lugar para cada persona
          </legend>
          <Field
            label="Capacidad máxima"
            id="capacity"
            error={error?.fields.capacity}
            hint="Cada inscripción reserva un cupo. No puede ser menor que las inscripciones confirmadas."
          >
            <input
              {...field("capacity")}
              className="capacity-input"
              type="number"
              min={1}
              max={1000000}
            />
          </Field>
        </fieldset>
        <div className="form-bottom">
          <span className="small muted inline-icon">
            <Clock3 size={18} />
            {editing
              ? "Los cambios se guardan al confirmar."
              : "Tu evento empieza como borrador privado."}
          </span>
          <div className="inline-actions">
            <Link to="/manage" className="button tertiary">
              Cancelar
            </Link>
            <button
              className="button primary"
              disabled={busy || categories.loading || !!categories.error}
            >
              {busy
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Guardar borrador"}
              {!busy && <ArrowUpRight size={19} />}
            </button>
          </div>
        </div>
      </form>
      <Modal
        open={blocker.state === "blocked"}
        title="Tienes cambios sin guardar"
        onClose={() => blocker.state === "blocked" && blocker.reset()}
      >
        <p>Si sales ahora, se perderán los cambios de este formulario.</p>
        <div className="modal-actions">
          <button
            className="button secondary"
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            Seguir editando
          </button>
          <button
            className="button primary"
            onClick={() => blocker.state === "blocked" && blocker.proceed()}
          >
            Salir sin guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
