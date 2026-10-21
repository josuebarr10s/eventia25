import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, Ticket } from "lucide-react";
import { EventBrowser } from "./Explore";

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="hero-star">✳</div>
      <div className="ticket-card">
        <div className="ticket-top">
          <span>Nos vemos ahí</span>
          <Sparkles size={24} />
        </div>
        <div className="ticket-center">
          <span>Admite a</span>
          <strong>
            tu mejor
            <br />
            versión.
          </strong>
          <div className="ticket-arrow">
            <ArrowUpRight size={38} />
          </div>
        </div>
        <div className="ticket-bottom">
          <div className="barcode">|||| ||| | |||| || ||| | ||||</div>
          <span>UN PLAN. MIL POSIBILIDADES.</span>
        </div>
      </div>
      <div className="art-tag">
        <span className="status-dot" /> Tu próximo recuerdo empieza aquí
      </div>
    </div>
  );
}

export function Home() {
  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            <span className="status-dot" /> Haz espacio para algo nuevo
          </p>
          <h1 tabIndex={-1}>
            Los mejores planes
            <br />
            empiezan con un
            <br />
            <span className="hero-highlight">
              «vamos»
              <svg
                viewBox="0 0 300 18"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M3 12Q130 0 295 8" />
              </svg>
            </span>
            .
          </h1>
          <p>
            Descubre eventos, encuentra a tu gente y convierte un día cualquiera
            en una buena historia.
          </p>
          <Link className="button primary" to="/explore">
            Encuentra tu próximo plan <ArrowUpRight size={20} />
          </Link>
          <div className="hero-note">
            <Ticket size={18} aria-hidden="true" />
            <span>Elige un evento. Reserva tu lugar. Disfruta.</span>
          </div>
        </div>
        <HeroArt />
      </section>
      <EventBrowser home />
      <section className="community-strip container">
        <span className="community-symbol" aria-hidden="true">
          ✳
        </span>
        <div>
          <h2>Los buenos momentos se comparten.</h2>
          <p>
            Un taller, una canción, una idea. Siempre hay algo por descubrir.
          </p>
        </div>
        <Link to="/explore" className="button secondary">
          Encuentra tu comunidad <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
