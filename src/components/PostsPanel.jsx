import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import {
  HiOutlineExclamationTriangle,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineMagnifyingGlass,
  HiOutlineTrash,
  HiOutlineArrowUturnLeft,
  HiOutlineTag,
  HiOutlineLockClosed,
} from "react-icons/hi2";
import { db } from "../services/firebase";
import { REMOVAL_REASONS, notifyPostRemoved } from "../utils/notifications";
import { categoryLabel } from "../constants/categories";
import { serviceCategoryEmoji, serviceCategoryLabel } from "../constants/serviceCategories";

const inter = { fontFamily: "'Inter', sans-serif" };

const formatKs = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);

const timeAgo = (date) => {
  if (!date) return "";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const nameOf = (u) =>
  (u?.fullName && u.fullName.trim()) ||
  (u?.username && u.username.trim()) ||
  (u?.email ? u.email.split("@")[0] : "Unknown user");

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "listing", label: "Listings" },
  { key: "service", label: "Services" },
];

const STATUS_FILTERS = [
  { key: "live", label: "Live" },
  { key: "off", label: "Sold / Paused" },
  { key: "removed", label: "Removed" },
  { key: "all", label: "All" },
];

const STATUS_PILL = {
  active: { text: "Live", cls: "text-[#86efac]", bg: "rgba(74,222,128,0.15)" },
  sold: { text: "Sold", cls: "text-[#fca5a5]", bg: "rgba(248,113,113,0.16)" },
  paused: { text: "Paused", cls: "text-[#fcd34d]", bg: "rgba(251,191,36,0.14)" },
  removed: { text: "Removed", cls: "text-[#f4e6cd]/60", bg: "rgba(255,255,255,0.08)" },
};

const matchesStatus = (status, f) =>
  f === "all" ||
  (f === "live" && status === "active") ||
  (f === "off" && (status === "sold" || status === "paused")) ||
  (f === "removed" && status === "removed");

// Admin Posts tab: every listing and service, with Remove / Restore.
// firestore.rules lets an admin change ONLY a post's status, and only to
// "active" or "removed", which is exactly what these two buttons do.
export default function PostsPanel({ users, toast }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("live");
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  // Remove / Lock first ask for a reason, which is sent to the owner.
  const [confirm, setConfirm] = useState(null); // { key, mode: "remove" | "lock" }
  const [reason, setReason] = useState("");
  const askReason = (key, mode) => {
    setConfirm({ key, mode });
    setReason("");
  };

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const load = useCallback(async () => {
    setLoadErr(false);
    try {
      const [ls, ss] = await Promise.all([getDocs(collection(db, "listings")), getDocs(collection(db, "services"))]);
      const list = [
        ...ls.docs.map((d) => ({ kind: "listing", id: d.id, ownerId: d.data().sellerId, ...d.data() })),
        ...ss.docs.map((d) => ({ kind: "service", id: d.id, ownerId: d.data().providerId, ...d.data() })),
      ].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setPosts(list);
    } catch (err) {
      console.error("Posts load failed:", err);
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byType = useMemo(() => posts.filter((p) => typeFilter === "all" || p.kind === typeFilter), [posts, typeFilter]);

  const counts = useMemo(
    () => Object.fromEntries(STATUS_FILTERS.map((f) => [f.key, byType.filter((p) => matchesStatus(p.status, f.key)).length])),
    [byType]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return byType
      .filter((p) => matchesStatus(p.status, statusFilter))
      .filter(
        (p) =>
          !q ||
          (p.title || "").toLowerCase().includes(q) ||
          nameOf(usersById[p.ownerId]).toLowerCase().includes(q)
      );
  }, [byType, statusFilter, search, usersById]);

  const setStatus = async (post, next, why = "") => {
    const key = `${post.kind}/${post.id}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      // removedByAdmin locks the post so its owner can't restore it
      // (firestore.rules, stage 14). Restore clears the lock again.
      const removedByAdmin = next === "removed";
      await updateDoc(doc(db, post.kind === "listing" ? "listings" : "services", post.id), {
        status: next,
        removedByAdmin,
      });
      setPosts((list) =>
        list.map((p) => (p.kind === post.kind && p.id === post.id ? { ...p, status: next, removedByAdmin } : p))
      );
      setConfirm(null);
      if (next === "removed") {
        await notifyPostRemoved({
          uid: post.ownerId,
          itemType: post.kind,
          itemId: post.id,
          itemTitle: post.title,
          reason: why,
        });
      }
      toast(
        next === "removed"
          ? post.status === "removed"
            ? `Locked “${post.title}”. The owner can't restore it.`
            : `Removed “${post.title}”.`
          : `Restored “${post.title}”.`
      );
    } catch (err) {
      console.error("Status change failed:", err);
      toast("Couldn't update — please try again.", false);
    } finally {
      setBusyKey(null);
    }
  };

  const pillBtn = (active) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60 ${
      active
        ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd]"
        : "border border-white/10 bg-white/[0.04] text-[#f4e6cd]/70 hover:border-[#c9963f]/40 hover:text-[#f4e6cd]"
    }`;

  return (
    <div className="relative z-10">
      <h2 className="mb-4 text-xl font-bold text-white" style={inter}>Posts</h2>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)} className={pillBtn(typeFilter === f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d6bd97]/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or poster…"
            className="w-full rounded-xl border border-[#d6bd97]/20 bg-[#090704]/70 py-2 pl-10 pr-3 text-sm text-[#f4e6cd] placeholder:text-white/30 outline-none transition focus:border-[#c9963f]"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)} className={pillBtn(statusFilter === f.key)}>
            {f.label}
            <span className="ml-1.5 opacity-60">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          ))}
        </div>
      ) : loadErr ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-red-400/25 px-4 py-10 text-center">
          <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
          <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load posts</p>
          <button
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="mt-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/75 hover:bg-white/[0.09] hover:text-white"
          >
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-[#f4e6cd]/40">
          No posts match these filters.
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((p) => {
            const key = `${p.kind}/${p.id}`;
            const busy = busyKey === key;
            const basePill = STATUS_PILL[p.status] || STATUS_PILL.active;
            // Who removed it: an unlocked removal is the owner's own (or from before stage 14).
            const pill =
              p.status === "removed"
                ? { ...basePill, text: p.removedByAdmin ? "Removed by admin" : "Removed by owner" }
                : basePill;
            const photo = p.photos && p.photos[0];
            const owner = usersById[p.ownerId];
            const link = p.kind === "listing" ? `/marketplace/${p.id}` : `/services/${p.id}`;
            return (
              <div
                key={key}
                className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-3 transition-colors hover:border-white/[0.14]"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                  style={{ background: "linear-gradient(135deg,#3a2a14 0%,#8f774b 55%,#c9963f 100%)" }}
                >
                  {photo ? (
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : p.kind === "service" ? (
                    <span className="text-xl" aria-hidden="true">{serviceCategoryEmoji(p.category)}</span>
                  ) : (
                    <HiOutlineTag className="h-5 w-5 text-[#f4e6cd]/70" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-white">{p.title}</span>
                    <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#f4e6cd]/60">
                      {p.kind === "listing" ? "Listing" : "Service"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${pill.cls}`}
                      style={{ background: pill.bg }}
                    >
                      {pill.text}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[#f4e6cd]/50">
                    Ks {formatKs(p.price)} · {p.kind === "listing" ? categoryLabel(p.category) : serviceCategoryLabel(p.category)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#f4e6cd]/40">
                    {nameOf(owner)}
                    {owner?.banned && <span className="ml-1 text-[#fca5a5]">(banned)</span>} · {timeAgo(p.createdAt?.toDate?.())}
                  </p>
                </div>

                <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
                  <Link
                    to={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-[12.5px] font-semibold text-[#c9963f] transition-colors hover:text-[#d6bd97]"
                  >
                    Open <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5" />
                  </Link>
                  {p.status === "removed" ? (
                    <>
                      {confirm?.key === key ? (
                        <ReasonPicker
                          label="Lock"
                          reason={reason}
                          setReason={setReason}
                          busy={busy}
                          onConfirm={() => setStatus(p, "removed", reason)}
                          onCancel={() => setConfirm(null)}
                        />
                      ) : (
                        <>
                      {!p.removedByAdmin && (
                        <button
                          onClick={() => askReason(key, "lock")}
                          disabled={busy}
                          title="Keep it removed: the owner won't be able to restore it"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d6bd97]/35 px-3.5 py-2 text-[12.5px] font-semibold text-[#d6bd97] transition-all hover:bg-[#c9963f]/10 disabled:opacity-40"
                        >
                          <HiOutlineLockClosed className="h-4 w-4" /> Lock
                        </button>
                      )}
                      <button
                        onClick={() => setStatus(p, "active")}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#86efac]/40 px-3.5 py-2 text-[12.5px] font-semibold text-[#86efac] transition-all hover:bg-[#86efac]/10 disabled:opacity-40"
                      >
                        <HiOutlineArrowUturnLeft className="h-4 w-4" /> Restore
                      </button>
                        </>
                      )}
                    </>
                  ) : confirm?.key === key ? (
                    <ReasonPicker
                      label="Remove"
                      reason={reason}
                      setReason={setReason}
                      busy={busy}
                      onConfirm={() => setStatus(p, "removed", reason)}
                      onCancel={() => setConfirm(null)}
                    />
                  ) : (
                    <button
                      onClick={() => askReason(key, "remove")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#fca5a5]/40 px-3.5 py-2 text-[12.5px] font-semibold text-[#fca5a5] transition-all hover:bg-[#fca5a5]/10 disabled:opacity-40"
                    >
                      <HiOutlineTrash className="h-4 w-4" /> Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// "Why?" chips shown before Remove / Lock. The reason goes to the owner in
// their Activity feed; the button stays disabled until one is picked.
function ReasonPicker({ label, reason, setReason, busy, onConfirm, onCancel }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto" role="group" aria-label="Reason for removal">
      <span className="mr-1 text-[12px] text-[#f4e6cd]/50">Why?</span>
      {REMOVAL_REASONS.map((r) => (
        <button
          key={r.key}
          type="button"
          aria-pressed={reason === r.key}
          onClick={() => setReason(r.key)}
          disabled={busy}
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
            reason === r.key
              ? "bg-[#f87171]/90 text-white"
              : "border border-white/10 text-white/60 hover:border-[#fca5a5]/40 hover:text-white"
          }`}
        >
          {r.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || !reason}
        className="ml-1 rounded-xl bg-[#f87171]/90 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-all hover:bg-[#f87171] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-xl border border-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-white/70 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}
