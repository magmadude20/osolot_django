import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getOsolotAPI,
  PostType,
  Status,
  type MembershipSummary,
  type PostDetail,
  type UserSummary,
} from "../api/generated";
import { useAuth } from "../auth/AuthContext";
import "../App.css";

const api = getOsolotAPI();

function detailMessage(err: unknown): string {
  const ax = err as AxiosError<{ detail?: string }>;
  const d = ax.response?.data?.detail;
  return typeof d === "string" ? d : "Request failed.";
}

function activeMembershipCollectives(
  memberships: MembershipSummary[],
): { slug: string; name: string }[] {
  const out: { slug: string; name: string }[] = [];
  for (const m of memberships) {
    if (m.status !== Status.active) continue;
    const slug = m.collective.slug;
    if (!slug) continue;
    out.push({ slug, name: m.collective.name });
  }
  return out;
}

type Mode = "new" | "edit";

export default function PostFormPage({ mode }: { mode: Mode }) {
  const { postSlug } = useParams<{ postSlug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [collectives, setCollectives] = useState<
    { slug: string; name: string }[]
  >([]);
  const [friends, setFriends] = useState<UserSummary[]>([]);

  const [type, setType] = useState<PostType>(PostType.offer);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [shareWithNewCollectivesDefault, setShareWithNewCollectivesDefault] =
    useState(true);
  const [shareWithNewFriendsDefault, setShareWithNewFriendsDefault] =
    useState(true);
  const [selectedCollectiveSlugs, setSelectedCollectiveSlugs] = useState<
    string[]
  >([]);
  const [selectedFriendUsernames, setSelectedFriendUsernames] = useState<
    string[]
  >([]);

  const slugOk = mode === "new" || Boolean(postSlug?.trim());

  const selectedSet = useMemo(
    () => new Set(selectedCollectiveSlugs),
    [selectedCollectiveSlugs],
  );
  const selectedFriendsSet = useMemo(
    () => new Set(selectedFriendUsernames),
    [selectedFriendUsernames],
  );

  function toggleCollective(slug: string) {
    setSelectedCollectiveSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function toggleFriend(username: string) {
    setSelectedFriendUsernames((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  }

  function friendLabel(f: UserSummary): string {
    const name = [f.first_name, f.last_name].filter(Boolean).join(" ").trim();
    return name ? `${name} (${f.username})` : f.username;
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPageLoading(false);
      return;
    }
    if (mode === "edit" && !slugOk) {
      setError("Missing post.");
      setPageLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setError(null);
      setPageLoading(true);
      try {
        const [memberships, friendList] = await Promise.all([
          api.osolotServerApiUsersListMyMemberships(),
          api.osolotServerApiUsersListMyFriends(),
        ]);
        if (cancelled) return;
        setCollectives(activeMembershipCollectives(memberships));
        setFriends(friendList);

        if (mode === "edit" && postSlug) {
          const detail: PostDetail = await api.osolotServerApiPostsGetPost(
            postSlug,
          );
          if (cancelled) return;
          setType(
            detail.type === PostType.request ? PostType.request : PostType.offer,
          );
          setTitle(detail.title);
          setDescription(detail.description ?? "");
          const sh = detail.sharing;
          setIsPublic(Boolean(sh?.public));
          setShareWithNewCollectivesDefault(
            sh?.share_with_new_collectives_default ?? true,
          );
          setShareWithNewFriendsDefault(
            sh?.share_with_new_friends_default ?? true,
          );
          setSelectedCollectiveSlugs(
            (sh?.shared_collectives ?? [])
              .map((c) => c.slug)
              .filter((s): s is string => Boolean(s)),
          );
          setSelectedFriendUsernames(
            (sh?.shared_friends ?? [])
              .map((u) => u.username)
              .filter((u): u is string => Boolean(u)),
          );
        }
      } catch (e) {
        if (!cancelled) setError(detailMessage(e));
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, mode, postSlug, slugOk]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === "new") {
        await api.osolotServerApiPostsCreatePost({
          type,
          title: title.trim(),
          description,
          public: isPublic,
          share_with_new_collectives_default: shareWithNewCollectivesDefault,
          share_with_new_friends_default: shareWithNewFriendsDefault,
          shared_collective_slugs: selectedCollectiveSlugs,
          shared_friend_usernames: selectedFriendUsernames,
        });
        navigate("/posts");
        return;
      }
      if (!postSlug) return;
      await api.osolotServerApiPostsUpdatePost(postSlug, {
        type,
        title: title.trim(),
        description,
        public: isPublic,
        share_with_new_collectives_default: shareWithNewCollectivesDefault,
        share_with_new_friends_default: shareWithNewFriendsDefault,
        shared_collective_slugs: selectedCollectiveSlugs,
        shared_friend_usernames: selectedFriendUsernames,
      });
      navigate("/posts");
    } catch (err) {
      setError(detailMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (mode !== "edit" || !postSlug) return;
    if (!confirm("Delete this post permanently?")) return;
    setDeleting(true);
    setError(null);
    try {
      await api.osolotServerApiPostsDeletePost(postSlug);
      navigate("/posts");
    } catch (err) {
      setError(detailMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || pageLoading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>{mode === "new" ? "New post" : "Edit post"}</h1>
        <p className="muted">Sign in to manage posts.</p>
        <Link to="/login" className="btn">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{mode === "new" ? "New post" : "Edit post"}</h1>
        <p className="muted">
          Set visibility and choose which collectives and friends can see this
          post.
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <form onSubmit={handleSubmit} className="form">
          <label className="label">
            Type
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as PostType)}
            >
              <option value={PostType.offer}>Offer</option>
              <option value={PostType.request}>Request</option>
            </select>
          </label>

          <label className="label">
            Title
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <label className="label">
            Description
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public (discoverable by anyone who can see posts)
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={shareWithNewCollectivesDefault}
              onChange={(e) =>
                setShareWithNewCollectivesDefault(e.target.checked)
              }
            />
            Share with new collectives by default
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={shareWithNewFriendsDefault}
              onChange={(e) =>
                setShareWithNewFriendsDefault(e.target.checked)
              }
            />
            Share with new friends by default
          </label>

          <fieldset className="fieldset">
            <legend>Share with collectives</legend>
            <p className="muted small">
              Only collectives you are an active member of are listed.
            </p>
            {collectives.length === 0 ? (
              <p className="muted">You are not an active member of any collective.</p>
            ) : (
              <div className="collective-pick-list">
                {collectives.map((c) => (
                  <label key={c.slug} className="checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(c.slug)}
                      onChange={() => toggleCollective(c.slug)}
                    />
                    <span>{c.name}</span>
                    <span className="muted small"> ({c.slug})</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend>Share with friends</legend>
            <p className="muted small">
              Only users you are friends with are listed. This is separate from
              collective sharing.
            </p>
            {friends.length === 0 ? (
              <p className="muted">You have no friends yet.</p>
            ) : (
              <div className="collective-pick-list">
                {friends.map((f) => (
                  <label key={f.username} className="checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFriendsSet.has(f.username)}
                      onChange={() => toggleFriend(f.username)}
                    />
                    <span>{friendLabel(f)}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="row">
            <button className="btn" type="submit" disabled={saving || !title.trim()}>
              {saving ? "Saving…" : mode === "new" ? "Create post" : "Save changes"}
            </button>
            <Link to="/posts" className="btn secondary">
              Cancel
            </Link>
          </div>
        </form>
      </section>

      {mode === "edit" ? (
        <section className="card danger-zone">
          <h2>Delete post</h2>
          <p className="muted">This cannot be undone.</p>
          <button
            type="button"
            className="btn danger"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? "Deleting…" : "Delete post"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
