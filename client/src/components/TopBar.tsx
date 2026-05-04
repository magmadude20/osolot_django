import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function TopBar() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  const from = location.pathname + location.search + location.hash;

  return (
    <header className="header topbar">
      <Link to="/" className="brand">
        Osolot
      </Link>
      <nav className="nav-links">
        <NavLink to="/collectives" className="link">
          Collectives
        </NavLink>
        <NavLink to="/posts" className="link">
          Posts
        </NavLink>
        <NavLink to="/posts/browse" className="link">
          View posts
        </NavLink>
        <NavLink to="/friends" className="link">
          Friends
        </NavLink>
        <NavLink to="/" className="link">
          My profile
        </NavLink>

        <span className="nav-spacer" />

        {loading ? null : user ? (
          <button type="button" className="btn secondary" onClick={logout}>
            Log out
          </button>
        ) : (
          <Link to="/login" state={{ from }} className="btn">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}

