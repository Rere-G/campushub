import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HiCheckCircle,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineXMark,
  HiXCircle,
} from "react-icons/hi2";
import { REVIEW_REASONS } from "../utils/adminLog";

const inter = { fontFamily: "'Inter', sans-serif" };
// "Please add your student ID number." -> "Add your student ID number"
const chipLabel = (r) => {
  const t = r.replace(/^Please /, "").replace(/\.$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const filled = (v) => String(v ?? "").trim() !== "";
const isUrl = (v) => /^https?:\/\//i.test(String(v || ""));
const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Stage 18c-2: everything an admin needs to decide on one account, with
// Approve / Request changes / Ban (or Revoke / Unban) right here.
export default function AdminUserView({ user: u, self, busy, onApprove, onRevoke, onBan, onUnban, onRequestChanges, onClose }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const closeRef = useRef(null);
  const pending = !u.approved && !u.banned;
  const name = (u.fullName || "").trim() || (u.username || "").trim() || (u.email || "").split("@")[0] || "Student";
  const joined = toDate(u.createdAt);
  const noteAt = toDate(u.changesRequestedAt);

  useEffect(() => {
    const before = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (before instanceof HTMLElement) before.focus();
    };
  }, [onClose]);

  const checks = [
    { label: "Student ID", ok: filled(u.studentId) },
    { label: "Full name", ok: filled(u.fullName) },
    { label: "University", ok: filled(u.university) },
    { label: "Department", ok: filled(u.department) },
    { label: "Profile photo", ok: isUrl(u.profilePhoto) },
  ];
  const fields = [
    ["Email", u.email],
    ["University", u.university],
    ["Department", u.department],
    ["Graduation year", u.graduationYear],
    ["Joined", joined ? joined.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : ""],
  ];
  const status = u.banned ? ["Banned", "border-red-400/30 bg-red-400/10 text-red-300"]
    : u.approved ? ["Approved", "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"]
    : ["Pending", "border-[#c9963f]/35 bg-[#c9963f]/12 text-[#e8c88f]"];

  const sendNote = () => {
    const text = note.trim();
    if (!text || busy) return;
    onRequestChanges(u, text);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={inter}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auv-title"
        className="ch-scroll relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/[0.1] bg-[#16120c] text-white shadow-[0_30px_80px_rgba(0,0,0,0.65)] animate-[qv-up_.28s_ease-out] motion-reduce:animate-none sm:max-w-xl sm:rounded-[28px]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white"
        >
          <HiOutlineXMark className="h-5 w-5" />
        </button>

        {/* Identity */}
        <div className="flex items-center gap-4 border-b border-white/[0.07] p-6 pr-14">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold text-[#f4e6cd]"
            style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
          >
            {isUrl(u.profilePhoto) ? <img src={u.profilePhoto} alt={`${name}'s profile photo`} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 id="auv-title" className="truncate text-xl font-bold text-white" style={inter}>{name}</h2>
            {filled(u.username) && u.username.trim() !== name && <p className="truncate text-sm text-white/45">@{u.username.trim()}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${status[1]}`}>{status[0]}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/55">
                {u.role === "admin" ? "Admin" : "Student"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {/* Student ID */}
          <div className={`rounded-2xl border p-4 ${filled(u.studentId) ? "border-white/[0.08] bg-white/[0.03]" : "border-red-400/30 bg-red-400/[0.06]"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Student ID</p>
            {filled(u.studentId) ? (
              <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-white">{String(u.studentId).trim()}</p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-red-300">Not provided</p>
            )}
          </div>

          {/* Checklist */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Profile checklist</p>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5 text-sm">
                  {c.ok ? <HiCheckCircle className="h-4 w-4 text-emerald-400" /> : <HiXCircle className="h-4 w-4 text-red-400/80" />}
                  <span className={c.ok ? "text-white/80" : "text-white/45"}>{c.label}</span>
                  <span className="sr-only">{c.ok ? "provided" : "missing"}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Details */}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            {fields.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wider text-white/35">{k}</dt>
                <dd className={`truncate ${filled(v) ? "text-white/85" : "text-white/30"}`}>{filled(v) ? String(v) : "Not provided"}</dd>
              </div>
            ))}
          </dl>
          {filled(u.bio) && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/35">Bio</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-white/70">{u.bio}</p>
            </div>
          )}

          {/* Existing note */}
          {filled(u.changesRequested) && (
            <div className="rounded-2xl border border-[#c9963f]/30 bg-[#c9963f]/[0.07] p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8c88f]">
                <HiOutlineChatBubbleBottomCenterText className="h-4 w-4" /> Changes requested
                {noteAt && <span className="font-normal normal-case tracking-normal text-white/40">· {noteAt.toLocaleDateString()}</span>}
              </p>
              <p className="mt-1.5 text-sm text-[#f4e6cd]/85">{u.changesRequested}</p>
            </div>
          )}

          {/* Request changes form */}
          {asking && (
            <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
              <label htmlFor="auv-note" className="text-sm font-semibold text-white">What should they fix?</label>
              <p className="mt-0.5 text-xs text-white/40">They'll see this on their "awaiting approval" screen.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {REVIEW_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNote(r)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      note === r ? "border-[#c9963f]/60 bg-[#c9963f]/15 text-[#f4e6cd]" : "border-white/10 text-white/60 hover:border-[#c9963f]/40 hover:text-[#f4e6cd]"
                    }`}
                  >
                    {chipLabel(r)}
                  </button>
                ))}
              </div>
              <textarea
                id="auv-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="Or write your own note…"
                className="mt-3 w-full resize-none rounded-xl border border-[#d6bd97]/20 bg-[#090704]/70 px-3 py-2.5 text-sm text-[#f4e6cd] outline-none placeholder:text-white/30 focus:border-[#c9963f]"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-white/35">{note.length}/300</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAsking(false)} className="h-9 rounded-xl px-3 text-sm font-semibold text-white/60 hover:text-white">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendNote}
                    disabled={!note.trim() || busy}
                    className="h-9 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-4 text-sm font-semibold text-[#f4e6cd] disabled:opacity-40"
                  >
                    Send request
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!self && !asking && (
          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-white/[0.07] bg-[#16120c]/95 p-4 backdrop-blur">
            {pending && (
              <>
                <button
                  type="button"
                  onClick={() => onApprove(u)}
                  disabled={busy}
                  className="h-11 flex-1 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-4 text-sm font-semibold text-[#f4e6cd] transition hover:-translate-y-0.5 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setAsking(true)}
                  disabled={busy}
                  className="h-11 flex-1 rounded-2xl border border-[#c9963f]/40 px-4 text-sm font-semibold text-[#e8c88f] transition hover:bg-[#c9963f]/10 disabled:opacity-40"
                >
                  Request changes
                </button>
              </>
            )}
            {u.approved && !u.banned && (
              <button
                type="button"
                onClick={() => onRevoke(u)}
                disabled={busy}
                className="h-11 flex-1 rounded-2xl border border-[#d6bd97]/30 px-4 text-sm font-semibold text-[#d6bd97] transition hover:border-[#c9963f] disabled:opacity-40"
              >
                Revoke approval
              </button>
            )}
            {u.banned ? (
              <button
                type="button"
                onClick={() => onUnban(u)}
                disabled={busy}
                className="h-11 flex-1 rounded-2xl border border-emerald-400/40 px-4 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-40"
              >
                Unban
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onBan(u)}
                disabled={busy}
                className="h-11 rounded-2xl border border-red-400/40 px-5 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-40"
              >
                Ban
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
