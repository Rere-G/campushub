import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineFlag, HiFlag, HiOutlineXMark } from "react-icons/hi2";
import { REPORT_NOTE_MAX, REPORT_REASONS, hasReported, submitReport } from "../utils/reports";

const inter = { fontFamily: "'Inter', sans-serif" };

const NOUN = { listing: "listing", service: "service", comment: "comment" };

// The pop-up form. Rendered through a portal into document.body so no
// parent card's overflow-hidden can clip it. Defined at module scope so it
// never remounts when the page re-renders.
function ReportDialog({ noun, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef(null);

  // Focus the first reason once, when the dialog opens.
  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const needsNote = reason === "other";
  const canSend = reason && (!needsNote || note.trim().length > 0) && !sending;

  const send = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError("");
    const err = await onSubmit(reason, note);
    if (err) {
      setError(err);
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
      style={inter}
    >
      <form
        onSubmit={send}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#16120c]/95 p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:p-6"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg,#8f774b,#c9963f)" }} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="report-title" className="text-lg font-semibold text-white" style={inter}>
              Report this {noun}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#f4e6cd]/50">
              Only CampusHub admins see reports. The poster isn't told who reported them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            className="rounded-lg p-1 text-[#f4e6cd]/40 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Reason</legend>
          {REPORT_REASONS.map((r, i) => {
            const active = reason === r.key;
            return (
              <label
                key={r.key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  active ? "border-[#c9963f]/60 bg-[#c9963f]/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <input
                  ref={i === 0 ? firstRef : undefined}
                  type="radio"
                  name="report-reason"
                  value={r.key}
                  checked={active}
                  onChange={() => setReason(r.key)}
                  className="mt-1 accent-[#c9963f]"
                />
                <span>
                  <span className="block text-sm font-medium text-[#f4e6cd]">{r.label}</span>
                  <span className="block text-[11px] text-[#f4e6cd]/40">{r.hint}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <label htmlFor="report-note" className="mt-4 block text-xs font-medium text-[#f4e6cd]/60">
          Note {needsNote ? "(required)" : "(optional)"}
        </label>
        <textarea
          id="report-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={REPORT_NOTE_MAX}
          rows={3}
          placeholder="Anything that helps an admin understand the problem"
          className="mt-1.5 w-full resize-none rounded-2xl border border-[#d6bd97]/20 bg-[#090704]/70 px-4 py-3 text-sm text-[#f4e6cd] placeholder:text-white/30 outline-none transition focus:border-[#c9963f] focus:shadow-[0_0_0_4px_rgba(201,150,63,0.18)]"
        />
        <p className="mt-1 text-right text-[11px] tabular-nums text-[#f4e6cd]/35">
          {note.length}/{REPORT_NOTE_MAX}
        </p>

        {error && (
          <p role="alert" className="mt-2 text-xs text-[#fca5a5]">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/75 transition-all hover:bg-white/[0.09] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-sm font-bold text-[#f4e6cd] transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <HiOutlineFlag className="h-4 w-4" /> {sending ? "Sending…" : "Send report"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// A flag button that opens the dialog and remembers whether you've reported.
// variant "link": a small text button for the listing/service page.
// variant "icon": a tiny flag for each comment.
// Pages only render this for content the viewer does NOT own; the rules
// refuse self-reports anyway.
export default function ReportButton({
  uid,
  targetType,
  itemType,
  itemId,
  commentId = "",
  targetOwnerId,
  variant = "link",
  onReported,
}) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const noun = NOUN[targetType] || "post";

  // The page-level button checks up front so it can say "Reported" right
  // away. Comment flags check only when clicked, to avoid one read per comment.
  useEffect(() => {
    if (variant !== "link" || !uid) return;
    let alive = true;
    hasReported(uid, itemId, commentId)
      .then((r) => alive && setReported(r))
      .catch((err) => console.error("Report check failed:", err));
    return () => {
      alive = false;
    };
  }, [variant, uid, itemId, commentId]);

  const handleOpen = async () => {
    if (reported) return;
    if (variant === "icon") {
      try {
        if (await hasReported(uid, itemId, commentId)) {
          setReported(true);
          onReported?.("You've already reported this comment.");
          return;
        }
      } catch (err) {
        console.error("Report check failed:", err);
      }
    }
    setOpen(true);
  };

  // Returns an error message for the dialog, or nothing on success.
  const handleSubmit = async (reason, note) => {
    try {
      await submitReport({ uid, targetType, itemType, itemId, commentId, targetOwnerId, reason, note });
      setReported(true);
      setOpen(false);
      onReported?.("Thanks. An admin will review your report.");
      return null;
    } catch (err) {
      console.error("Report failed:", err);
      // A second report of the same thing is refused by the rules.
      try {
        if (await hasReported(uid, itemId, commentId)) {
          setReported(true);
          setOpen(false);
          onReported?.(`You've already reported this ${noun}.`);
          return null;
        }
      } catch {
        // fall through to the generic message
      }
      return "Couldn't send your report. Please try again.";
    }
  };

  const dialog = open && <ReportDialog noun={noun} onClose={() => setOpen(false)} onSubmit={handleSubmit} />;

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={handleOpen}
          disabled={reported}
          aria-label={reported ? "Comment reported" : "Report comment"}
          title={reported ? "Reported" : "Report"}
          className={`rounded-lg p-1 transition-colors ${
            reported ? "cursor-default text-[#d6bd97]/60" : "text-[#f4e6cd]/30 hover:bg-white/[0.06] hover:text-[#d6bd97]"
          }`}
        >
          {reported ? <HiFlag className="h-4 w-4" /> : <HiOutlineFlag className="h-4 w-4" />}
        </button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={reported}
        className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
          reported ? "cursor-default text-[#d6bd97]/60" : "text-[#f4e6cd]/40 hover:text-[#d6bd97]"
        }`}
      >
        {reported ? <HiFlag className="h-3.5 w-3.5" /> : <HiOutlineFlag className="h-3.5 w-3.5" />}
        {reported ? `You reported this ${noun}` : `Report this ${noun}`}
      </button>
      {dialog}
    </>
  );
}
