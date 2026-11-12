import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { db } from "../services/firebase";
import { logEntry, newLogRef } from "../utils/adminLog";
import AnnouncementBanner from "./AnnouncementBanner";

const inter = { fontFamily: "'Inter', sans-serif" };
const TITLE_MAX = 60;
const BODY_MAX = 280;
const fieldCls =
  "w-full rounded-xl border border-[#d6bd97]/20 bg-[#090704]/70 px-3.5 py-2.5 text-sm text-[#f4e6cd] outline-none transition placeholder:text-white/30 focus:border-[#c9963f]";

// Stage 18c-3: write the campus announcement shown on every student's
// Dashboard. One document (announcements/current); saving also writes an
// audit-log entry in the same batch.
export default function AnnouncementPanel({ adminUid, users, toast }) {
  const [loaded, setLoaded] = useState(null); // null loading | "error" | { exists, data }
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getDoc(doc(db, "announcements", "current"))
      .then((snap) => {
        if (!alive) return;
        const data = snap.exists() ? snap.data() : null;
        setLoaded({ exists: snap.exists(), data });
        if (data) {
          setTitle(data.title || "");
          setBody(data.body || "");
          setActive(data.active === true);
        }
      })
      .catch((err) => {
        console.error("Announcement load failed:", err);
        if (alive) setLoaded("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const valid = title.trim().length >= 1 && body.trim().length >= 1;
  const prev = loaded && loaded !== "error" ? loaded.data : null;
  const changed =
    !prev || prev.title !== title.trim() || prev.body !== body.trim() || (prev.active === true) !== active;

  const save = async () => {
    if (!valid || saving || !changed) return;
    setSaving(true);
    try {
      const data = { title: title.trim(), body: body.trim(), active, updatedAt: serverTimestamp(), updatedBy: adminUid };
      const batch = writeBatch(db);
      batch.set(doc(db, "announcements", "current"), data);
      batch.set(
        newLogRef(),
        logEntry({
          actorId: adminUid,
          action: "announcement_updated",
          targetType: "announcement",
          targetId: "current",
          targetLabel: data.title,
          reason: active ? "Shown to students" : "Hidden from students",
        })
      );
      await batch.commit();
      setLoaded({ exists: true, data: { ...data, updatedAt: { toDate: () => new Date() } } });
      toast(active ? "Announcement published." : "Announcement saved and hidden.");
    } catch (err) {
      console.error("Announcement save failed:", err);
      toast("Couldn't save — please try again.", false);
    } finally {
      setSaving(false);
    }
  };

  const updatedBy = prev ? users.find((u) => u.id === prev.updatedBy) : null;
  const updatedAt = prev?.updatedAt?.toDate?.();

  return (
    <div className="relative z-10" style={inter}>
      <h2 className="text-xl font-bold text-white" style={inter}>Announcement</h2>
      <p className="mb-5 text-xs text-white/40">
        One campus-wide notice shown at the top of every approved student's Dashboard.
      </p>

      {loaded === null ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : loaded === "error" ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-red-400/25 px-4 py-10 text-center">
          <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
          <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load the announcement</p>
          <p className="mt-1 text-sm text-white/40">Check your connection and refresh the page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between">
                <label htmlFor="ann-title" className="text-sm font-medium text-[#f4e6cd]/80">Title</label>
                <span className="text-[11px] text-white/35">{title.length}/{TITLE_MAX}</span>
              </div>
              <input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                placeholder="e.g. Exam week meetups"
                className={fieldCls}
              />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between">
                <label htmlFor="ann-body" className="text-sm font-medium text-[#f4e6cd]/80">Message</label>
                <span className="text-[11px] text-white/35">{body.length}/{BODY_MAX}</span>
              </div>
              <textarea
                id="ann-body"
                value={body}
                rows={4}
                onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                placeholder="e.g. During exam week, please only meet at the Main Library entrance."
                className={`${fieldCls} resize-none`}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-[#c9963f]"
              />
              <span>
                <span className="block text-sm font-medium text-[#f4e6cd]">Show to students</span>
                <span className="block text-[11px] text-white/40">Untick to hide it without deleting the text.</span>
              </span>
            </label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-white/35">
                {updatedAt
                  ? `Last saved ${updatedAt.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${
                      updatedBy ? ` by ${updatedBy.fullName || updatedBy.username || "an admin"}` : ""
                    }`
                  : "Not published yet"}
              </p>
              <button
                type="button"
                onClick={save}
                disabled={!valid || saving || !changed}
                className="h-11 shrink-0 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-6 text-sm font-semibold text-[#f4e6cd] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
              >
                {saving ? "Saving…" : active ? "Publish" : "Save hidden"}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Student preview</p>
            {valid && active ? (
              <AnnouncementBanner preview data={{ title: title.trim(), body: body.trim() }} />
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
                {active ? "Write a title and message to preview it." : "Hidden: students won't see anything."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
