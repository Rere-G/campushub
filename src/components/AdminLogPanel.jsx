import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import {
  HiOutlineCheckBadge,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineExclamationTriangle,
  HiOutlineFlag,
  HiOutlineLockClosed,
  HiOutlineMegaphone,
  HiOutlineNoSymbol,
  HiOutlineArrowUturnLeft,
  HiOutlineTrash,
  HiOutlineUserMinus,
} from "react-icons/hi2";
import { db } from "../services/firebase";
import { ACTION_GROUP, ACTION_TEXT } from "../utils/adminLog";

const inter = { fontFamily: "'Inter', sans-serif" };
const LOG_LIMIT = 100;
const FILTERS = [
  { key: "all", label: "All" },
  { key: "users", label: "Users" },
  { key: "posts", label: "Posts" },
  { key: "reports", label: "Reports" },
  { key: "announcements", label: "Announcements" },
];
const LOOK = {
  user_approved: [HiOutlineCheckBadge, "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"],
  user_revoked: [HiOutlineUserMinus, "text-[#d6bd97] border-[#c9963f]/30 bg-[#c9963f]/10"],
  user_banned: [HiOutlineNoSymbol, "text-red-300 border-red-400/30 bg-red-400/10"],
  user_unbanned: [HiOutlineArrowUturnLeft, "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"],
  changes_requested: [HiOutlineChatBubbleBottomCenterText, "text-[#e8c88f] border-[#c9963f]/35 bg-[#c9963f]/12"],
  post_removed: [HiOutlineTrash, "text-red-300 border-red-400/30 bg-red-400/10"],
  post_locked: [HiOutlineLockClosed, "text-red-300 border-red-400/30 bg-red-400/10"],
  post_restored: [HiOutlineArrowUturnLeft, "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"],
  report_dismissed: [HiOutlineFlag, "text-white/60 border-white/15 bg-white/[0.05]"],
  report_actioned: [HiOutlineFlag, "text-red-300 border-red-400/30 bg-red-400/10"],
  message_removed: [HiOutlineTrash, "text-red-300 border-red-400/30 bg-red-400/10"],
  announcement_updated: [HiOutlineMegaphone, "text-[#d6bd97] border-[#c9963f]/30 bg-[#c9963f]/10"],
};
const nameOf = (u) =>
  (u?.fullName && u.fullName.trim()) || (u?.username && u.username.trim()) || (u?.email ? u.email.split("@")[0] : "An admin");
const when = (d) =>
  d ? d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// Stage 18c-3: the admin audit log as a timeline (newest first). Read-only:
// firestore.rules make entries impossible to edit or delete.
export default function AdminLogPanel({ users }) {
  const [entries, setEntries] = useState(null); // null loading | "error" | []
  const [filter, setFilter] = useState("all");
  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  useEffect(() => {
    let alive = true;
    getDocs(query(collection(db, "adminLog"), orderBy("createdAt", "desc"), limit(LOG_LIMIT)))
      .then((snap) => alive && setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().createdAt?.toDate?.() ?? null }))))
      .catch((err) => {
        console.error("Activity log load failed:", err);
        if (alive) setEntries("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const shown = Array.isArray(entries) ? entries.filter((e) => filter === "all" || ACTION_GROUP(e.action) === filter) : [];

  return (
    <div className="relative z-10" style={inter}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white" style={inter}>Activity log</h2>
          <p className="text-xs text-white/40">Every admin action, newest first. Entries can't be edited or deleted.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter log">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd]"
                  : "border border-white/10 bg-white/[0.04] text-white/60 hover:border-[#c9963f]/40 hover:text-[#f4e6cd]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {entries === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          ))}
        </div>
      ) : entries === "error" ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-red-400/25 px-4 py-10 text-center">
          <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
          <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load the activity log</p>
          <p className="mt-1 text-sm text-white/40">Check your connection and refresh the page.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-white/40">
          {entries.length === 0 ? "No admin actions recorded yet." : "No actions of this type yet."}
        </p>
      ) : (
        <ol className="relative space-y-2 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-white/[0.08]">
          {shown.map((e) => {
            const [Icon, cls] = LOOK[e.action] || [HiOutlineFlag, "text-white/60 border-white/15 bg-white/[0.05]"];
            const actor = nameOf(usersById[e.actorId]);
            const target = e.action === "announcement_updated" ? "" : e.targetLabel || e.targetId;
            return (
              <li key={e.id} className="relative flex gap-3">
                <span className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${cls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <p className="text-sm text-white/75">
                    <span className="font-semibold text-white">{actor}</span> {ACTION_TEXT[e.action] || e.action}
                    {target && (
                      <>
                        {" "}
                        <span className="font-semibold text-[#f4e6cd]">{target}</span>
                      </>
                    )}
                    {e.action === "announcement_updated" && e.targetLabel && (
                      <>
                        : <span className="font-semibold text-[#f4e6cd]">{e.targetLabel}</span>
                      </>
                    )}
                    {["listing", "service", "comment", "message"].includes(e.targetType) && (
                      <span className="ml-1.5 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
                        {e.targetType}
                      </span>
                    )}
                  </p>
                  {e.reason && <p className="mt-1 text-xs italic leading-5 text-white/50">“{e.reason}”</p>}
                  <p className="mt-1 text-[11px] text-white/35">{when(e.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {Array.isArray(entries) && entries.length === LOG_LIMIT && (
        <p className="mt-3 text-center text-xs text-white/35">Showing the latest {LOG_LIMIT} actions.</p>
      )}
    </div>
  );
}
