import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ArrowRight, ArrowUpRight, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "./auth";
import { Alert, Brand, Loading } from "./components";

export function Layout() {
  const { user, loading, logout } = useAuth();
  const [menu, setMenu] = useState(false),
    [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const firstRender = useRef(true);
  useEffect(() => {
    setMenu(false);
    setError("");
    if (!firstRender.current)
      document.querySelector<HTMLElement>("main h1")?.focus();
    firstRender.current = false;
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  async function signOut() {
    navigate("/", { replace: true });
    try {
      await logout();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menu}
            aria-controls="navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav
            id="navigation"
            className={menu ? "navigation is-open" : "navigation"}
            aria-label="Principal"
          >
            <NavLink to="/" end>
              Inicio
            </NavLink>
            <NavLink to="/explore">Explorar eventos</NavLink>
            {user && <NavLink to="/registrations">Mis inscripciones</NavLink>}
            {user &&
              (user.can_create_events ||
                user.can_edit_events ||
                user.can_publish_events) && (
                <NavLink to="/manage">Mis eventos</NavLink>
              )}
            <div className="nav-account">
              {loading ? (
                <span className="small muted">Preparando sesión…</span>
              ) : user ? (
                <>
                  <span className="account-name" title={user.email}>
                    {user.name.split(" ")[0]}
                  </span>
                  <button
                    className="icon-button"
                    onClick={signOut}
                    aria-label="Cerrar sesión"
                  >
                    <LogOut size={19} />
                  </button>
                </>
              ) : (
                <>
                  <Link className="nav-login" to="/login">
                    Iniciar sesión
                  </Link>
                  <Link className="button primary small-button" to="/register">
                    Crear cuenta <ArrowUpRight size={17} />
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main id="main">
        {error && (
          <div className="container">
            <Alert>{error}</Alert>
          </div>
        )}
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Brand />
          <p>Menos rutina. Más historias para contar.</p>
          <span className="small muted">Hecho para encontrarnos.</span>
        </div>
      </footer>
    </>
  );
}

export function RequireAuth({
  children,
  organizer = false,
}: {
  children: ReactNode;
  organizer?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="container">
        <Loading label="Preparando tu sesión…" />
      </div>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (
    organizer &&
    !(user.can_create_events || user.can_edit_events || user.can_publish_events)
  )
    return (
      <div className="container page">
        <h1 tabIndex={-1}>Solo para organizadores</h1>
        <Alert>No tienes permisos para gestionar eventos.</Alert>
        <Link to="/explore" className="text-link">
          Explorar eventos <ArrowRight size={18} />
        </Link>
      </div>
    );
  return children;
}
