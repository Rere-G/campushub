import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, updateDoc } from "firebase/firestore";
import {
  HiOutlineUsers,
  HiOutlineTag,
  HiOutlineFlag,
  HiOutlineShieldCheck,
  HiOutlineCheckBadge,
  HiOutlineClock,
  HiOutlineNoSymbol,
  HiOutlineArrowLeft,
  HiOutlineLockClosed,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";

/* ─── Reduced-motion (module-level, read once) ─────────────────── */
const prefersReduced =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── Animated counter (mirrors Dashboard) ─────────────────────── */
function useCountUp(target, duration = 1000, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    let raf;
    const tick = (ts) => {
      if (!start) start = ts;
      // Reduced motion → jump to final value on the first frame.
      const p = prefersReduced ? 1 : Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(ease * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return count;
}

/* ─── Stat tile ────────────────────────────────────────────────── */
function StatTile({ label, value, icon: Icon, color, show, delay = 0 }) {
  const count = useCountUp(value, 1000, show);
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-4 text-center transition-all duration-500 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms, background 0.3s, border-color 0.3s`,
      }}
    >
      <div className="mb-2 flex justify-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="font-mono text-[28px] font-bold leading-none tabular-nums" style={{ color }}>
        {count}
      </p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#f4e6cd]/45">{label}</p>
    </div>
  );
}

/* ─── Section card (active / locked) ───────────────────────────── */
function SectionCard({ icon: Icon, title, desc, locked }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-5 py-4 ${
        locked
          ? "border-white/10 bg-white/[0.03] opacity-60"
          : "border-white/10 bg-white/[0.05] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c9963f]/50"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: locked
            ? "rgba(255,255,255,0.12)"
            : "linear-gradient(90deg,#8f774b,#c9963f)",
        }}
      />
      {locked && (
        <span className="absolute right-4 top-4 text-[#f4e6cd]/50">
          <HiOutlineLockClosed className="h-4 w-4" />
        </span>
      )}
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
        <Icon className="h-5 w-5 text-[#d6bd97]" />
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-[#f4e6cd]/50">{desc}</p>
      {locked && (
        <span className="mt-2 inline-block rounded-full bg-[#c9963f]/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-[#d6bd97]">
          Unlocks with Marketplace
        </span>
      )}
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────── */
const isUrl = (v) => /^https?:\/\//i.test(String(v || ""));
const displayName = (u) =>
  (u.fullName && u.fullName.trim()) ||
  (u.username && u.username.trim()) ||
  (u.email ? u.email.split("@")[0] : "Student");
const initialOf = (u) => displayName(u).trim().charAt(0).toUpperCase() || "U";
const metaLine = (u) => {
  const parts = [];
  if (u.university && String(u.university).trim()) parts.push(String(u.university).trim());
  if (u.department && String(u.department).trim()) parts.push(String(u.department).trim());
  if (u.studentId && String(u.studentId).trim()) parts.push(`ID ${String(u.studentId).trim()}`);
  return parts.join(" · ");
};

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "banned", label: "Banned" },
  { key: "all", label: "All" },
];
const EMPTY_COPY = {
  pending: "No students waiting for approval.",
  approved: "No approved students yet.",
  banned: "No banned users — all clear.",
  all: "No users found.",
};

/* ─── Main Admin ───────────────────────────────────────────────── */
export default function Admin() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [uid, setUid] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [tab, setTab] = useState("pending");
  const [busyId, setBusyId] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // { user, kind: 'ban' | 'revoke' }
  const [popup, setPopup] = useState({ show: false, text: "", ok: true });

  const toast = (text, ok = true) => {
    setPopup({ show: true, text, ok });
    setTimeout(() => setPopup((p) => ({ ...p, show: false })), 2200);
  };

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 120);
    const unsub = onAuthStateChanged(auth, async (current) => {
      if (!current) { navigate("/login"); return; }
      try {
        const meSnap = await getDoc(doc(db, "users", current.uid));
        if (!meSnap.exists() || meSnap.data().role !== "admin") {
          navigate("/dashboard");
          return;
        }
        setUid(current.uid);
        const all = await getDocs(collection(db, "users"));
        setUsers(all.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Admin load failed:", err);
        setLoadErr(true);
      } finally {
        setLoading(false);
      }
    });
    return () => { clearTimeout(timer); unsub(); };
  }, [navigate]);

  /* ── Esc closes the confirm modal ── */
  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e) => { if (e.key === "Escape") setConfirmState(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState]);

  const counts = useMemo(() => {
    const pending = users.filter((u) => !u.approved && !u.banned).length;
    const approved = users.filter((u) => u.approved && !u.banned).length;
    const banned = users.filter((u) => u.banned).length;
    return { pending, approved, banned, all: users.length };
  }, [users]);

  const visible = useMemo(() => {
    if (tab === "pending") return users.filter((u) => !u.approved && !u.banned);
    if (tab === "approved") return users.filter((u) => u.approved && !u.banned);
    if (tab === "banned") return users.filter((u) => u.banned);
    return users;
  }, [users, tab]);

  /* ── Partial-update write: optimistic, revert + toast on error ── */
  const applyChange = async (target, patch, successMsg) => {
    if (busyId) return;
    setBusyId(target.id);
    const prev = users;
    setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, ...patch } : u)));
    try {
      await updateDoc(doc(db, "users", target.id), patch);
      toast(successMsg, true);
    } catch (err) {
      console.error("Update failed:", err);
      setUsers(prev); // revert
      toast("Couldn't save — please try again.", false);
    } finally {
      setBusyId(null);
    }
  };

  const approve = (u) => applyChange(u, { approved: true }, `Approved ${displayName(u)}`);
  const unban = (u) => applyChange(u, { banned: false }, `Unbanned ${displayName(u)}`);

  const confirmProceed = () => {
    if (!confirmState) return;
    const { user, kind } = confirmState;
    setConfirmState(null);
    if (kind === "ban") applyChange(user, { banned: true }, `Banned ${displayName(user)}`);
    else applyChange(user, { approved: false }, `Revoked ${displayName(user)}`);
  };

  const card =
    "relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#0d0b07] text-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* BG */}
      <div className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${dashboardBg})` }} />
      <div className="absolute inset-0 bg-[#0d0b07]/85" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a120a]/45 via-[#0d0b07]/75 to-black/95" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* ── Header ── */}
        <header
          className={`${card} mb-6 px-6 py-5 transition-all duration-700 ${
            show ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          }`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(214,189,151,0.5),transparent)" }} />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">CampusHub</p>
                <span
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#d6bd97]"
                  style={{ border: "1px solid rgba(201,150,63,0.35)", background: "rgba(201,150,63,0.12)" }}
                >
                  <HiOutlineShieldCheck className="h-3 w-3" /> Admin
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl" style={{ fontFamily: "'Inter', sans-serif" }}>
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-[#f4e6cd]/55">Approvals &amp; moderation</p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 text-sm font-medium text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white"
            >
              <HiOutlineArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </div>
        </header>

        {/* ── Stat tiles ── */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Pending" value={counts.pending} icon={HiOutlineClock} color="#d6bd97" show={show} delay={80} />
          <StatTile label="Approved" value={counts.approved} icon={HiOutlineCheckBadge} color="#86efac" show={show} delay={160} />
          <StatTile label="Banned" value={counts.banned} icon={HiOutlineNoSymbol} color="#fca5a5" show={show} delay={240} />
          <StatTile label="Total users" value={counts.all} icon={HiOutlineUsers} color="#f4e6cd" show={show} delay={320} />
        </div>

        {/* ── Section cards ── */}
        <div
          className={`mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 transition-all duration-700 delay-150 ${
            show ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <SectionCard icon={HiOutlineUsers} title="Users & approvals" desc="Approve, revoke, and ban students." />
          <SectionCard icon={HiOutlineTag} title="Posts" desc="Review and remove listings." locked />
          <SectionCard icon={HiOutlineFlag} title="Reports" desc="Handle flagged posts and users." locked />
        </div>

        {/* ── Users panel ── */}
        <section
          className={`${card} p-5 transition-all duration-700 delay-200 ${
            show ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(201,150,63,0.45),transparent)" }} />
          <div className="relative z-10">
            <h2 className="mb-4 text-xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Users</h2>

            {/* Tabs */}
            <div className="mb-4 flex flex-wrap gap-2">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60 ${
                      active
                        ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd]"
                        : "border border-white/10 bg-white/[0.04] text-[#f4e6cd]/70 hover:border-[#c9963f]/40 hover:text-[#f4e6cd]"
                    }`}
                  >
                    {t.label}
                    <span className="ml-1.5 opacity-60">{counts[t.key]}</span>
                  </button>
                );
              })}
            </div>

            {/* List */}
            {loading ? (
              <div className="space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[76px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                ))}
              </div>
            ) : loadErr ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-red-400/25 px-4 py-10 text-center">
                <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
                <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load users</p>
                <p className="mt-1 max-w-[260px] text-sm text-white/40">Check your connection and refresh the page.</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-[#f4e6cd]/40">
                {EMPTY_COPY[tab]}
              </div>
            ) : (
              <div className="space-y-2.5">
                {visible.map((u) => {
                  const self = u.id === uid;
                  const busy = busyId === u.id;
                  const statusPill = u.banned
                    ? { text: "Banned", cls: "text-[#fca5a5]", bg: "rgba(248,113,113,0.16)" }
                    : u.approved
                    ? { text: "Approved", cls: "text-[#86efac]", bg: "rgba(74,222,128,0.15)" }
                    : { text: "Pending", cls: "text-[#d6bd97]", bg: "rgba(201,150,63,0.15)" };
                  return (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-3 transition-colors duration-200 hover:border-white/[0.14]"
                    >
                      {/* Avatar */}
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-semibold text-[#f4e6cd]"
                        style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
                      >
                        {isUrl(u.profilePhoto) ? (
                          <img src={u.profilePhoto} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initialOf(u)
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-white">{displayName(u)}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]"
                            style={
                              u.role === "admin"
                                ? { background: "rgba(214,189,151,0.16)", color: "#d6bd97" }
                                : { background: "rgba(255,255,255,0.08)", color: "rgba(244,230,205,0.6)" }
                            }
                          >
                            {u.role === "admin" ? "Admin" : "Student"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${statusPill.cls}`}
                            style={{ background: statusPill.bg }}
                          >
                            {statusPill.text}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[#f4e6cd]/50">{u.email}</p>
                        {metaLine(u) && <p className="mt-0.5 truncate text-xs text-[#f4e6cd]/40">{metaLine(u)}</p>}
                      </div>

                      {/* Actions */}
                      <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                        {self ? (
                          <span className="px-1 py-2 text-xs italic text-[#f4e6cd]/45">You</span>
                        ) : (
                          <>
                            {u.approved ? (
                              <button
                                onClick={() => setConfirmState({ user: u, kind: "revoke" })}
                                disabled={busy}
                                className="flex-1 rounded-xl border border-[#d6bd97]/30 px-3.5 py-2 text-[12.5px] font-semibold text-[#d6bd97] transition-all duration-150 hover:border-[#c9963f] hover:text-[#f4e6cd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60 disabled:opacity-40 sm:flex-none"
                              >
                                Revoke
                              </button>
                            ) : (
                              <button
                                onClick={() => approve(u)}
                                disabled={busy}
                                className="flex-1 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-3.5 py-2 text-[12.5px] font-semibold text-[#f4e6cd] transition-all duration-150 hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60 disabled:opacity-40 sm:flex-none"
                              >
                                Approve
                              </button>
                            )}
                            {u.banned ? (
                              <button
                                onClick={() => unban(u)}
                                disabled={busy}
                                className="flex-1 rounded-xl border border-[#86efac]/40 px-3.5 py-2 text-[12.5px] font-semibold text-[#86efac] transition-all duration-150 hover:bg-[#86efac]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-40 sm:flex-none"
                              >
                                Unban
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmState({ user: u, kind: "ban" })}
                                disabled={busy}
                                className="flex-1 rounded-xl border border-[#fca5a5]/40 px-3.5 py-2 text-[12.5px] font-semibold text-[#fca5a5] transition-all duration-150 hover:bg-[#fca5a5]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:opacity-40 sm:flex-none"
                              >
                                Ban
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <footer className="mt-6 flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6 py-3.5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/20">CampusHub © {new Date().getFullYear()}</p>
          <p className="text-[11px] text-white/15">Admin</p>
        </footer>
      </div>

      {/* ── Confirm modal (Ban / Revoke) ── */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmState(null)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-[22px] border border-white/10 bg-[#14100a] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
              style={{
                background:
                  confirmState.kind === "ban"
                    ? "linear-gradient(90deg,#fca5a5,#f87171)"
                    : "linear-gradient(90deg,#8f774b,#c9963f)",
              }}
            />
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
              {confirmState.kind === "ban" ? "Ban this student?" : "Revoke approval?"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#f4e6cd]/60">
              {confirmState.kind === "ban" ? (
                <>
                  <span className="font-semibold text-white">{displayName(confirmState.user)}</span> will be blocked from CampusHub. You can unban them later.
                </>
              ) : (
                <>
                  <span className="font-semibold text-white">{displayName(confirmState.user)}</span> will lose approved access until you approve them again.
                </>
              )}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmState(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/80 transition-all duration-150 hover:bg-white/[0.09] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Cancel
              </button>
              <button
                onClick={confirmProceed}
                autoFocus
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 ${
                  confirmState.kind === "ban"
                    ? "bg-[#f87171]/90 text-white hover:bg-[#f87171] focus-visible:ring-red-400/50"
                    : "bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd] hover:from-[#9c8352] hover:to-[#d6a24a] focus-visible:ring-[#c9963f]/60"
                }`}
              >
                {confirmState.kind === "ban" ? "Ban" : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {popup.show && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-[calc(16px+env(safe-area-inset-top,0px))] z-[70] w-72 max-w-[78vw] rounded-xl p-4 text-sm font-semibold text-white shadow-lg ${
            prefersReduced ? "" : "animate-admin-slide-in"
          } ${popup.ok ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f]" : "bg-gradient-to-r from-red-500 to-rose-500"}`}
        >
          {popup.text}
        </div>
      )}

      <style>{`
        @keyframes admin-slide-in {
          0% { transform: translateX(120%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-admin-slide-in { animation: admin-slide-in 0.35s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .animate-admin-slide-in { animation: none; }
        }
      `}</style>
    </div>
  );
}
