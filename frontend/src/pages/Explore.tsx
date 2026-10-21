import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Search, Sparkles, X } from "lucide-react";
import {
  Alert,
  CategoryIcon,
  Empty,
  ErrorState,
  EventRow,
  Loading,
  Pagination,
} from "../components";
import { useResource } from "../hooks/useResource";
import type { Category, Event, Page } from "../types";

export function Explore() {
  return (
    <div className="container page">
      <div className="page-heading">
        <p className="eyebrow">Algo bueno está por pasar</p>
        <h1 tabIndex={-1}>Encuentra tu próximo plan.</h1>
        <p className="muted">Sigue tu curiosidad. El resto empieza aquí.</p>
      </div>
      <EventBrowser />
    </div>
  );
}

export function EventBrowser({ home = false }: { home?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const category = params.get("category") || "";
  const searchParam = params.get("search") || "";
  const rawPage = Number(params.get("page"));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const query = new URLSearchParams({
    search: params.get("search") || "",
    category,
    page: String(page),
  });
  const { data, error, loading, reload } = useResource<Page<Event>>(
    `/events/?${query}`,
  );
  const categories = useResource<Category[]>("/events/categories/");
  useEffect(() => {
    setSearch(searchParam);
  }, [searchParam]);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { preventScrollReset: true });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    change("search", search.trim());
  }
  return (
    <section
      className={home ? "container discovery" : "discovery"}
      aria-label={home ? undefined : "Eventos disponibles"}
      aria-labelledby={home ? "events-heading" : undefined}
    >
      {home && (
        <div className="section-heading">
          <div>
            <p className="eyebrow">Sal de lo de siempre</p>
            <h2 id="events-heading">
              Próximos encuentros<span className="accent-dot">.</span>
            </h2>
          </div>
          <Link to="/explore" className="text-link">
            Ver todos los eventos <ArrowUpRight size={18} />
          </Link>
        </div>
      )}
      <div className="discovery-toolbar">
        <form className="search-form" onSubmit={submit} role="search">
          <label htmlFor="event-search" className="sr-only">
            Buscar eventos por nombre
          </label>
          <Search size={20} aria-hidden="true" />
          <input
            id="event-search"
            type="search"
            placeholder="¿Qué te gustaría hacer?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={180}
          />
          {search && (
            <button
              className="icon-button"
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setSearch("");
                change("search", "");
              }}
            >
              <X size={17} />
            </button>
          )}
          <button className="search-submit" type="submit">
            Buscar <ArrowRight size={17} />
          </button>
        </form>
        <span className="small muted desktop-hint">
          Un plan para cada curiosidad <Sparkles size={17} />
        </span>
      </div>
      <div className="filters" aria-label="Filtrar por categoría">
        <button
          className={`filter-chip ${!category ? "selected" : ""}`}
          aria-pressed={!category}
          onClick={() => change("category", "")}
        >
          Todos los planes
        </button>
        {categories.data?.map((item) => (
          <button
            key={item.value}
            className={`filter-chip ${category === item.value ? "selected" : ""}`}
            aria-pressed={category === item.value}
            onClick={() => change("category", item.value)}
          >
            <CategoryIcon category={item.value} size={17} />
            {item.label}
          </button>
        ))}
      </div>
      {categories.error && (
        <Alert kind="info">
          Las categorías no están disponibles en este momento. Puedes buscar por
          nombre.
        </Alert>
      )}
      <div className="results-heading" aria-live="polite">
        <span>
          {loading
            ? "Consultando eventos…"
            : `${data?.count || 0} ${data?.count === 1 ? "evento para descubrir" : "eventos para descubrir"}`}
        </span>
        <span>Más próximos primero</span>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : !data?.results.length ? (
        <Empty
          title={
            category || params.get("search")
              ? "No encontramos eventos con esos filtros"
              : "Los próximos encuentros están por llegar"
          }
        >
          <p>
            {category || params.get("search")
              ? "Prueba otra búsqueda o descubre todos los planes."
              : "Cuando se publique un evento, podrás encontrarlo aquí."}
          </p>
          {(category || params.get("search")) && (
            <button className="button secondary" onClick={() => setParams({})}>
              Limpiar filtros
            </button>
          )}
        </Empty>
      ) : (
        <>
          <div className="event-list">
            {data.results.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
          <Pagination
            count={data.count}
            page={page}
            onPage={(p) => change("page", String(p))}
          />
        </>
      )}
    </section>
  );
}
