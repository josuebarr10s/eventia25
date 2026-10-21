import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export function NotFound() {
  return (
    <div className="container page">
      <p className="eyebrow">404 · Aquí no hay plan</p>
      <h1 tabIndex={-1}>Nos fuimos por otro camino.</h1>
      <p className="muted">
        La página que buscas no existe. Hay más por descubrir.
      </p>
      <Link to="/explore" className="button primary">
        Explorar eventos <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
