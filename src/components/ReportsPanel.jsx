import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  HiOutlineExclamationTriangle,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineTrash,
  HiOutlineNoSymbol,
  HiOutlineCheck,
  HiOutlineFlag,
} from "react-icons/hi2";
import { db } from "../services/firebase";
import { REPORT_REASONS } from "../utils/reports";

const inter = { fontFamily: "'Inter', sans-serif" };

const reasonLabel = (key) => REPORT_REASONS.find((r) => r.key === key)?.label || key;

const timeAgo = (date) => {
  if (!date) return "just now";
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

const collFor = (itemType) => (itemType === "listing" ? "listings" : "services");
const itemPath = (r) => `${collFor(r.itemType)}/${r.itemId}`;
const targetPath = (r) => (r.targetType === "comment" ? `${itemPath(r)}/comments/${r.commentId}` : itemPath(r));
const pageLink = (r) => (r.itemType === "listing" ? `/marketplace/${r.itemId}` : `/services/${r.itemId}`);

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

const OUTCOME = {
  dismissed: { text: "Dismissed", cls: "text-[#f4e6cd]/60", bg: "rgba(255,255,255,0.08)" },
  removed: { text: "Content removed", cls: "text-[#fcd34d]", bg: "rgba(251,191,36,0.14)" },
  banned: { text: "Poster banned", cls: "text-[#fca5a5]", bg: "rgba(248,113,113,0.16)" },
};

// Admin Reports tab. Admin.jsx owns the users list (for names and the ban
// state), so it passes it in and is told when a ban happens.
export default function ReportsPanel({ adminUid, users, onUserBanned, onOpenCountChange, toast }) {
  const [reports, setReports] = useState([]);
  const [targets, setTargets] = useState({}); // path -> { exists, data }
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [filter, setFilter] = useState("open");
  const [busyId, setBusyId] = useState(null);
  const [banFor, setBanFor] = useState(null); // report being banned on
  const [alsoRemove, setAlsoRemove] = useState(true);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const load = useCallback(async () => {
    setLoadErr(false);
    try {
      const snap = await getDocs(collection(db, "reports"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReports(list);

      // Fetch each reported item (and, for comments, the comment) once.
      const paths = [...new Set(list.flatMap((r) => [itemPath(r), targetPath(r)]))];
      const entries = await Promise.all(
        paths.map(async (p) => {
          try {
            const s = await getDoc(doc(db, p));
            return [p, { exists: s.exists(), data: s.exists() ? s.data() : null }];
          } catch {
            return [p, { exists: false, data: null }];
          }
        })
      );
      setTargets(Object.fromEntries(entries));
    } catch (err) {
      console.error("Reports load failed:", err);
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCount = reports.filter((r) => r.status === "open").length;
  useEffect(() => {
    if (!loading && !loadErr) onOpenCountChange?.(openCount);
  }, [openCount, loading, loadErr, onOpenCountChange]);

  const counts = useMemo(
    () => ({ open: openCount, resolved: reports.length - openCount, all: reports.length }),
    [reports, openCount]
  );

  const visible = useMemo(() => {
    if (filter === "open") return reports.filter((r) => r.status === "open");
    if (filter === "resolved") return reports.filter((r) => r.status !== "open");
    return reports;
  }, [reports, filter]);

  // Marks this report, and every other OPEN report about the same content,
  // as resolved. One removal answers all of them.
  const resolve = async (report, status, action) => {
    const sameTarget = reports.filter(
      (r) => r.status === "open" && targetPath(r) === targetPath(report) && (action !== "dismissed" || r.id === report.id)
    );
    const patch = { status, action, resolvedBy: adminUid, resolvedAt: serverTimestamp() };
    for (const r of sameTarget) {
      await updateDoc(doc(db, "reports", r.id), patch);
    }
    const ids = new Set(sameTarget.map((r) => r.id));
    setReports((list) =>
      list.map((r) => (ids.has(r.id) ? { ...r, status, action, resolvedBy: adminUid, resolvedAt: null } : r))
    );
    return sameTarget.length;
  };

  const removeContent = async (report) => {
    if (report.targetType === "comment") {
      await deleteDoc(doc(db, targetPath(report)));
    } else {
      await updateDoc(doc(db, itemPath(report)), { status: "removed" });
    }
    setTargets((t) => ({
      ...t,
      [targetPath(report)]:
        report.targetType === "comment"
          ? { exists: false, data: null }
          : { exists: true, data: { ...(t[targetPath(report)]?.data || {}), status: "removed" } },
    }));
  };

  const handleRemove = async (report) => {
    if (busyId) return;
    setBusyId(report.id);
    try {
      await removeContent(report);
      const n = await resolve(report, "actioned", "removed");
      toast(n > 1 ? `Content removed. ${n} reports closed.` : "Content removed and report closed.");
    } catch (err) {
      console.error("Remove failed:", err);
      toast("Couldn't remove — please try again.", false);
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (report) => {
    if (busyId) return;
    setBusyId(report.id);
    try {
      await resolve(report, "dismissed", "dismissed");
      toast("Report dismissed.");
    } catch (err) {
      console.error("Dismiss failed:", err);
      toast("Couldn't dismiss — please try again.", false);
    } finally {
      setBusyId(null);
    }
  };

  const handleBan = async () => {
    const report = banFor;
    if (!report || busyId) return;
    setBanFor(null);
    setBusyId(report.id);
    try {
      await updateDoc(doc(db, "users", report.targetOwnerId), { banned: true });
      onUserBanned?.(report.targetOwnerId);
      const t = targets[targetPath(report)];
      const canRemove = t?.exists && !(report.targetType !== "comment" && t.data?.status === "removed");
      if (alsoRemove && canRemove) await removeContent(report);
      await resolve(report, "actioned", "banned");
      toast(`Banned ${nameOf(usersById[report.targetOwnerId])}.`);
    } catch (err) {
      console.error("Ban failed:", err);
      toast("Couldn't ban — please try again.", false);
    } finally {
      setBusyId(null);
    }
  };

  // Esc closes the ban confirm.
  useEffect(() => {
    if (!banFor) return;
    const onKey = (e) => {
      if (e.key === "Escape") setBanFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [banFor]);

  return (
    <div className="relative z-10">
      <h2 className="mb-4 text-xl font-bold text-white" style={inter}>Reports</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60 ${
                active
                  ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd]"
                  : "border border-white/10 bg-white/[0.04] text-[#f4e6cd]/70 hover:border-[#c9963f]/40 hover:text-[#f4e6cd]"
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          ))}
        </div>
      ) : loadErr ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-red-400/25 px-4 py-10 text-center">
          <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
          <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load reports</p>
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
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center">
          <HiOutlineFlag className="h-6 w-6 text-[#f4e6cd]/30" />
          <p className="mt-3 text-sm text-[#f4e6cd]/45">
            {filter === "open" ? "No open reports — all clear." : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const item = targets[itemPath(r)];
            const target = targets[targetPath(r)];
            const poster = usersById[r.targetOwnerId];
            const reporter = usersById[r.reporterId];
            const busy = busyId === r.id;
            const isOpen = r.status === "open";
            const gone = !target?.exists;
            const alreadyRemoved = r.targetType !== "comment" && target?.data?.status === "removed";
            const posterBanned = !!poster?.banned;
            const posterIsAdmin = poster?.role === "admin" || r.targetOwnerId === adminUid;
            const outcome = OUTCOME[r.action];
            const typeLabel = r.targetType === "comment" ? `Comment on a ${r.itemType}` : r.targetType === "listing" ? "Listing" : "Service";

            return (
              <article key={r.id} className="rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#f87171]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#fca5a5]">
                    {reasonLabel(r.reason)}
                  </span>
                  <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[11px] font-medium text-[#f4e6cd]/60">
                    {typeLabel}
                  </span>
                  {!isOpen && outcome && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${outcome.cls}`} style={{ background: outcome.bg }}>
                      {outcome.text}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-[#f4e6cd]/35">
                    {timeAgo(r.createdAt?.toDate?.())} by {nameOf(reporter)}
                  </span>
                </div>

                {r.note && (
                  <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#f4e6cd]/75">
                    “{r.note}”
                  </p>
                )}

                {/* What was reported */}
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                      {item?.data?.title || (item?.exists === false ? "Deleted item" : "…")}
                    </p>
                    {item?.exists && (
                      <Link
                        to={pageLink(r)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#c9963f] hover:text-[#d6bd97]"
                      >
                        Open <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                  {r.targetType === "comment" && (
                    <p className="mt-1.5 whitespace-pre-wrap break-words border-l-2 border-[#c9963f]/40 pl-2.5 text-xs leading-relaxed text-[#f4e6cd]/65">
                      {target?.exists ? target.data.text : "This comment has been deleted."}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-[#f4e6cd]/45">
                    Posted by <span className="font-semibold text-[#f4e6cd]/70">{nameOf(poster)}</span>
                    {posterBanned && <span className="ml-1.5 text-[#fca5a5]">(banned)</span>}
                    {alreadyRemoved && <span className="ml-1.5 text-[#fcd34d]">· already removed</span>}
                  </p>
                </div>

                {isOpen && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleRemove(r)}
                      disabled={busy || gone || alreadyRemoved}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#fcd34d]/35 px-3.5 py-2 text-[12.5px] font-semibold text-[#fcd34d] transition-all hover:bg-[#fcd34d]/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <HiOutlineTrash className="h-4 w-4" /> Remove content
                    </button>
                    <button
                      onClick={() => {
                        setAlsoRemove(!(gone || alreadyRemoved));
                        setBanFor(r);
                      }}
                      disabled={busy || posterBanned || posterIsAdmin}
                      title={posterIsAdmin ? "Admins can't be banned here" : undefined}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#fca5a5]/40 px-3.5 py-2 text-[12.5px] font-semibold text-[#fca5a5] transition-all hover:bg-[#fca5a5]/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <HiOutlineNoSymbol className="h-4 w-4" /> Ban poster
                    </button>
                    <button
                      onClick={() => handleDismiss(r)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[12.5px] font-semibold text-white/75 transition-all hover:bg-white/[0.09] hover:text-white disabled:opacity-35"
                    >
                      <HiOutlineCheck className="h-4 w-4" /> Dismiss
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ── Ban confirm ── */}
      {banFor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setBanFor(null)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-[22px] border border-white/10 bg-[#14100a] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg,#fca5a5,#f87171)" }} />
            <h3 className="text-lg font-bold text-white" style={inter}>Ban this student?</h3>
            <p className="mt-2 text-sm leading-6 text-[#f4e6cd]/60">
              <span className="font-semibold text-white">{nameOf(usersById[banFor.targetOwnerId])}</span> will be blocked
              from CampusHub. You can unban them later from the Users tab.
            </p>
            {(() => {
              const t = targets[targetPath(banFor)];
              const removable = t?.exists && !(banFor.targetType !== "comment" && t.data?.status === "removed");
              return removable ? (
                <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-[#f4e6cd]/75">
                  <input
                    type="checkbox"
                    checked={alsoRemove}
                    onChange={(e) => setAlsoRemove(e.target.checked)}
                    className="h-4 w-4 accent-[#f87171]"
                  />
                  Also remove the reported {banFor.targetType}
                </label>
              ) : null;
            })()}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setBanFor(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/80 transition-all duration-150 hover:bg-white/[0.09]"
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                autoFocus
                className="flex-1 rounded-xl bg-[#f87171]/90 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#f87171]"
              >
                Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
