import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Alert,
  Badge,
  date,
  Empty,
  ErrorState,
  Loading,
  Modal,
  Pagination,
} from "../components";
import { useResource } from "../hooks/useResource";
import type { Event, Page } from "../types";

export function Manage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { data, error, loading, reload } = useResource<Page<Event>>(
    `/events/mine/?page=${page}`,
  );
  const [publish, setPublish] = useState<Event | null>(null),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState("");
  async function confirm() {
    if (!publish) return;
    setBusy(true);
    setFailure("");
    try {
      await api(`/events/${publish.id}/publish/`, {
        method: "POST",
        body: "{}",
      });
      setPublish(null);
      setNotice("Evento publicado. Ya se puede descubrir e inscribir.");
      reload();
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Dale vida a tu próxima idea</p>
          <h1 tabIndex={-1}>
            Mis eventos<span className="accent-dot">.</span>
          </h1>
          <p className="muted">Crea encuentros que valga la pena compartir.</p>
        </div>
        {user?.can_create_events && (
          <Link className="button primary" to="/manage/new">
            <Plus size={19} /> Crear evento
          </Link>
        )}
      </div>
      {notice && <Alert kind="success">{notice}</Alert>}
      {loading ? (
        <Loading label="Cargando tus eventos…" />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : !data?.results.length ? (
        <Empty title="Todo gran encuentro empieza con una idea">
          <p>Crea tu primer borrador. Podrás revisarlo antes de publicarlo.</p>
        </Empty>
      ) : (
        <>
          <p className="management-summary">
            <strong>{data.count}</strong>{" "}
            {data.count === 1 ? "evento creado" : "eventos creados"}
          </p>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Tus eventos y sus acciones</caption>
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Inscripciones</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <Link className="table-title" to={`/events/${event.id}`}>
                        {event.title}
                      </Link>
                      <span className="small muted table-subtitle">
                        {event.category_label}
                        {event.is_demo ? " · Demostración" : ""}
                      </span>
                    </td>
                    <td>
                      {date(event.starts_at, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <Badge warning={event.status === "draft"}>
                        {event.status === "draft" ? "Borrador" : "Publicado"}
                      </Badge>
                    </td>
                    <td>
                      {event.registered_count}{" "}
                      <span className="muted">/ {event.capacity}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {event.can_edit &&
                          new Date(event.starts_at) > new Date() && (
                            <Link
                              className="button tertiary small-button"
                              to={`/manage/${event.id}/edit`}
                            >
                              Editar
                            </Link>
                          )}
                        {event.status === "draft" && event.can_publish && (
                          <button
                            className="button secondary small-button"
                            onClick={() => {
                              setFailure("");
                              setPublish(event);
                            }}
                          >
                            Publicar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            count={data.count}
            page={page}
            onPage={(p) => setParams({ page: String(p) })}
          />
        </>
      )}
      <Modal
        open={!!publish}
        title="¿Publicamos este encuentro?"
        onClose={() => {
          if (!busy) setPublish(null);
        }}
      >
        <p>
          <strong>{publish?.title}</strong> será visible para todos. Los
          participantes podrán reservar sus cupos.
        </p>
        {failure && <Alert>{failure}</Alert>}
        <div className="modal-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setPublish(null)}
          >
            Seguir revisando
          </button>
          <button className="button primary" disabled={busy} onClick={confirm}>
            {busy ? "Publicando…" : "Publicar evento"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
