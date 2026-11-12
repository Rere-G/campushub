import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { HiOutlineExclamationTriangle, HiOutlineXMark } from "react-icons/hi2";
import { db } from "../services/firebase";
import { spotLabel } from "../utils/chat";
import { currencyOf, formatPrice } from "../utils/postDetails";

const inter = { fontFamily: "'Inter', sans-serif" };
const when = (d) =>
  d ? d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// Admin, read-only: the full conversation behind a chat report.
// firestore.rules lets admins read a chat ONLY if one of its two people
// reported it, so this works from the Reports tab and nowhere else.
export default function ChatReviewDialog({ convId, highlightId, nameOf, onClose }) {
  const [conv, setConv] = useState(null);
  const [currency, setCurrency] = useState("MMK");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, m] = await Promise.all([
          getDoc(doc(db, "conversations", convId)),
          getDocs(query(collection(db, "conversations", convId, "messages"), orderBy("createdAt", "asc"), limit(300))),
        ]);
        if (!alive) return;
        setConv(c.exists() ? c.data() : null);
        if (c.exists()) {
          const cd = c.data();
          getDoc(doc(db, cd.itemType === "service" ? "services" : "listings", cd.itemId))
            .then((it) => alive && it.exists() && setCurrency(currencyOf(it.data())))
            .catch(() => {});
        }
        setMessages(m.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().createdAt?.toDate?.() ?? null })));
      } catch (e) {
        console.error("Chat review load failed:", e);
        if (alive) setErr(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [convId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Scroll the reported message into view once loaded.
  useEffect(() => {
    if (!loading && highlightId) document.getElementById(`review-${highlightId}`)?.scrollIntoView({ block: "center" });
  }, [loading, highlightId]);

  const body = (m) => {
    if (m.deleted) return <em className="text-white/40">{m.removedByAdmin ? "Removed by a moderator" : "Deleted by the sender"}</em>;
    if (m.type === "offer") return `Offer: ${formatPrice(m.amount, currency)} (${m.status})`;
    if (m.type === "meeting") return `Meetup: ${spotLabel(m.spot)}, ${when(m.meetAt?.toDate?.())} (${m.status})`;
    return m.text;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={inter}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="review-title" className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#16120c] text-white shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0">
            <h2 id="review-title" className="text-base font-semibold text-white" style={inter}>Reported chat</h2>
            <p className="mt-0.5 truncate text-xs text-white/45">
              {conv ? `${nameOf(conv.buyerId)} and ${nameOf(conv.sellerId)} · ${conv.itemTitle}` : " "}
            </p>
            <p className="mt-1 text-[11px] text-[#d6bd97]/70">Read-only. Visible to admins because this chat was reported.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-white">
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>
        <div className="ch-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : err || !conv ? (
            <p className="flex items-center gap-2 text-sm text-red-300">
              <HiOutlineExclamationTriangle className="h-4 w-4" /> Couldn't open this chat.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {messages.map((m) => (
                <li
                  key={m.id}
                  id={`review-${m.id}`}
                  className={`rounded-xl border px-3 py-2 ${
                    m.id === highlightId ? "border-[#f87171]/60 bg-[#f87171]/10" : "border-white/[0.07] bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[#d6bd97]">{nameOf(m.senderId)}</span>
                    <span className="text-[10px] text-white/35">{when(m.at)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[#f4e6cd]/85">{body(m)}</p>
                  {m.id === highlightId && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#fca5a5]">Reported message</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
