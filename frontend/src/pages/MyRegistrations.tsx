import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import {
  Badge,
  date,
  Empty,
  ErrorState,
  EventRow,
  Loading,
  Pagination,
} from "../components";
import { useResource } from "../hooks/useResource";
import type { Page, Registration } from "../types";

export function MyRegistrations() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { data, error, loading, reload } = useResource<Page<Registration>>(
    `/registrations/?page=${page}`,
  );
  return (
    <div className="container page">
      <div className="page-heading">
        <p className="eyebrow">Tu agenda de buenos momentos</p>
        <h1 tabIndex={-1}>
          Mis inscripciones<span className="accent-dot">.</span>
        </h1>
        <p className="muted">Un lugar reservado. Una experiencia por vivir.</p>
      </div>
      {loading ? (
        <Loading label="Buscando tus inscripciones…" />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : !data?.results.length ? (
        <Empty title="Tu próximo plan te está esperando">
          <p>Explora los eventos y reserva tu primer lugar.</p>
          <Link className="button primary" to="/explore">
            Descubrir eventos <ArrowUpRight size={18} />
          </Link>
        </Empty>
      ) : (
        <>
          <div className="registration-list">
            {data.results.map((item) => (
              <div key={item.id} className="registration-item">
                <EventRow event={item.event} />
                <div className="registration-receipt">
                  <Badge>
                    <Check size={14} /> Confirmada · #{item.id}
                  </Badge>
                  <span className="small muted">
                    Te inscribiste el {date(item.created_at)}
                  </span>
                  {item.notification_status === "console" && (
                    <span className="caption muted">
                      Correo generado en consola de desarrollo
                    </span>
                  )}
                  {item.notification_status === "failed" && (
                    <span className="caption warning-text">
                      El correo no se pudo enviar. Tu inscripción sigue
                      confirmada.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination
            count={data.count}
            page={page}
            onPage={(p) => setParams({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
