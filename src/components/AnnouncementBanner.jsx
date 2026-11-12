import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { HiOutlineMegaphone, HiOutlineXMark } from "react-icons/hi2";
import { db } from "../services/firebase";

const inter = { fontFamily: "'Inter', sans-serif" };
const DISMISS_KEY = "ch-announcement-dismissed";

// Stage 18c-3: the campus announcement at the top of the student Dashboard.
// Hidden after "Dismiss" until an admin publishes a new version.
// `preview` + `data` show it inside the admin composer instead.
export default function AnnouncementBanner({ preview = false, data: previewData = null }) {
  const [ann, setAnn] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (preview) return;
    let alive = true;
    getDoc(doc(db, "announcements", "current"))
      .then((snap) => {
        if (!alive || !snap.exists()) return;
        const d = snap.data();
        if (d.active === true) setAnn({ ...d, version: String(d.updatedAt?.toMillis?.() || "") });
      })
      .catch(() => {
        /* no announcement / not allowed: show nothing */
      });
    return () => {
      alive = false;
    };
  }, [preview]);

  const shown = preview ? previewData : ann;
  if (!shown || (!preview && ann.version && dismissed === ann.version)) return null;

  const dismiss = () => {
    setDismissed(ann.version);
    try {
      localStorage.setItem(DISMISS_KEY, ann.version);
    } catch {
      /* not remembered on this device */
    }
  };

  return (
    <div
      role="status"
      className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[#c9963f]/35 bg-gradient-to-r from-[#c9963f]/[0.14] to-[#c9963f]/[0.04] px-4 py-3.5 backdrop-blur-xl"
      style={inter}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#c9963f]/40 bg-[#c9963f]/15 text-[#e8c88f]">
        <HiOutlineMegaphone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e8c88f]/80">Campus announcement</p>
        <p className="mt-0.5 text-sm font-semibold text-white">{shown.title}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-[#f4e6cd]/75">{shown.body}</p>
      </div>
      {!preview && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="rounded-lg p-1 text-white/45 transition hover:bg-white/[0.08] hover:text-white"
        >
          <HiOutlineXMark className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
