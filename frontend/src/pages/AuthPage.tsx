import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Eye, EyeOff, Ticket } from "lucide-react";
import { ApiError } from "../api";
import { useAuth } from "../auth";
import { Alert, Field, Loading } from "../components";

export function AuthPage({ kind }: { kind: "login" | "register" }) {
  const { user, loading, login } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next") || "/explore";
  const safeNext =
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/login") &&
    !next.startsWith("/register")
      ? next
      : "/explore";
  const navigate = useNavigate();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiError | null>(null);
  const register = kind === "register";
  useEffect(() => {
    setError(null);
    setShow(false);
  }, [kind]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      await login(kind, values);
      navigate(safeNext, { replace: true });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="container">
        <Loading label="Preparando tu sesión…" />
      </div>
    );
  if (user) return <Navigate to={safeNext} replace />;
  return (
    <div className="auth-page container">
      <div className="auth-decoration" aria-hidden="true">
        <span>✳</span>
        <p>
          Hay personas,
          <br />
          ideas y planes
          <br />
          <strong>por descubrir.</strong>
        </p>
        <Ticket size={42} />
      </div>
      <section className="auth-surface">
        <p className="eyebrow">
          {register
            ? "Tu próxima historia empieza aquí"
            : "Qué bueno verte de nuevo"}
        </p>
        <h1 tabIndex={-1}>
          {register ? "Hagamos planes." : "Vuelve a conectar."}
        </h1>
        <p className="muted">
          {register
            ? "Crea tu cuenta y encuentra experiencias para ti."
            : "Inicia sesión para seguir con tus planes."}
        </p>
        <form key={kind} onSubmit={submit}>
          {error && <Alert>{error.message}</Alert>}
          {register && (
            <Field label="Tu nombre" id="name" error={error?.fields.name}>
              <input
                id="name"
                name="name"
                autoComplete="name"
                maxLength={150}
                required
                aria-invalid={!!error?.fields.name}
                aria-describedby={error?.fields.name ? "name-error" : undefined}
              />
            </Field>
          )}
          <Field
            label="Correo electrónico"
            id="email"
            error={error?.fields.email}
          >
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              aria-invalid={!!error?.fields.email}
              aria-describedby={error?.fields.email ? "email-error" : undefined}
            />
          </Field>
          <Field
            label="Contraseña"
            id="password"
            error={error?.fields.password}
            hint={
              register
                ? "Al menos 10 caracteres. Evita contraseñas comunes o similares a tus datos."
                : undefined
            }
          >
            <div className="password-input">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 10 : undefined}
                maxLength={128}
                required
                aria-invalid={!!error?.fields.password}
                aria-describedby={
                  error?.fields.password
                    ? "password-error"
                    : register
                      ? "password-hint"
                      : undefined
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </Field>
          <button className="button primary full-width" disabled={busy}>
            {busy
              ? "Un momento…"
              : register
                ? "Crear mi cuenta"
                : "Iniciar sesión"}
            {!busy && <ArrowUpRight size={19} />}
          </button>
        </form>
        <p className="auth-switch">
          {register ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
          <Link
            to={`/${register ? "login" : "register"}?next=${encodeURIComponent(safeNext)}`}
          >
            {register ? "Inicia sesión" : "Crea una cuenta"}
          </Link>
        </p>
        <p className="caption muted">
          {register
            ? "Tu cuenta se crea como participante. Solo solicitamos los datos necesarios para tus inscripciones."
            : "Tus planes y tus inscripciones, en un solo lugar."}
        </p>
      </section>
    </div>
  );
}
