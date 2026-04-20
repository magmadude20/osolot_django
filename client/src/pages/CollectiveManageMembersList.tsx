import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CollectiveDetail, MembershipSummary } from "../api/generated";
import { getOsolotAPI } from "../api/generated";
import {
  fetchCollective,
  isAbortError,
  isValidCollectiveSlug,
} from "../api/collectives-queries";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

const api = getOsolotAPI();

export default function CollectiveManageMembersList() {
  const { collectiveSlug } = useParams<{ collectiveSlug: string }>();
  const slug = collectiveSlug ?? "";
  const slugOk = isValidCollectiveSlug(slug);
  const { user, loading: authLoading } = useAuth();

  const [collective, setCollective] = useState<CollectiveDetail | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugOk) {
      setLoadError("Invalid collective.");
      return;
    }
    const ac = new AbortController();
    setLoadError(null);
    setCollective(null);
    setMemberships(null);
    void (async () => {
      try {
        const c = await fetchCollective(slug, ac.signal);
        const list = await api.osolotServerApiCollectiveMembershipsListMemberships(slug);
        if (ac.signal.aborted) return;
        setCollective(c);
        setMemberships(list);
      } catch (e) {
        if (isAbortError(e)) return;
        setLoadError("Could not load collective or members.");
      }
    })();
    return () => ac.abort();
  }, [slug, slugOk]);

  const canManage = useMemo(() => {
    if (!user || !collective) return false;
    return collective.members.some(
      (m) =>
        m.user.id === user.id &&
        m.status === "active" &&
        (m.role === "admin" || m.role === "moderator"),
    );
  }, [user, collective]);

  const sortedMemberships = useMemo(() => {
    if (!memberships) return [];
    return [...memberships].sort((a, b) => {
      const ap = a.status === "pending" ? 0 : 1;
      const bp = b.status === "pending" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const an = `${a.user.first_name} ${a.user.last_name}`.trim();
      const bn = `${b.user.first_name} ${b.user.last_name}`.trim();
      return an.localeCompare(bn);
    });
  }, [memberships]);

  const detailHref = slugOk ? `/collectives/${slug}` : "/collectives";

  if (authLoading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <header className="header">
          <h1>Manage members</h1>
          <Link to={detailHref} className="link">
            Back
          </Link>
        </header>
        <p className="muted">Log in to manage members.</p>
        <Link to="/login" state={{ from: detailHref }} className="btn">
          Log in
        </Link>
      </div>
    );
  }

  if (loadError || !slugOk) {
    return (
      <div className="page">
        <p className="error">{loadError ?? "Invalid collective."}</p>
        <Link to="/collectives" className="link">
          All collectives
        </Link>
      </div>
    );
  }

  if (!collective || memberships === null) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="page">
        <header className="header">
          <h1>Manage members</h1>
          <Link to={detailHref} className="link">
            Back
          </Link>
        </header>
        <p className="error">Only admins and moderators can manage members.</p>
      </div>
    );
  }

  return (
    <div className="page manage-members">
      <header className="header">
        <h1>Members · {collective.summary.name}</h1>
        <Link to={detailHref} className="link">
          Back to collective
        </Link>
      </header>

      <ul className="manage-member-cards">
        {sortedMemberships.map((m) => {
          const uid = m.user.id;
          const name =
            `${m.user.first_name} ${m.user.last_name}`.trim() || `User #${uid}`;
          const pending = m.status === "pending";
          const href = `/collectives/${slug}/members/manage/${uid}`;

          return (
            <li
              key={uid}
              className={`card manage-member-card ${pending ? "pending" : ""}`}
            >
              <Link to={href} className="manage-member-link">
                <div className="manage-member-title">
                  <strong>{name}</strong>
                  <span className="member-meta">
                    {m.role} · {m.status}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

