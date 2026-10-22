import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  HiOutlineArrowLeft,
  HiOutlineCalendarDays,
  HiOutlineExclamationTriangle,
  HiOutlineMapPin,
  HiOutlinePaperAirplane,
  HiOutlineShieldCheck,
  HiOutlineShoppingBag,
  HiOutlineWrenchScrewdriver,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import {
  MESSAGE_MAX,
  isConversationUnread,
  markConversationRead,
  sendText,
  spotLabel,
} from "../utils/chat";

const inter = { fontFamily: "'Inter', sans-serif" };
const formatKs = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);
const timeOfDay = (d) => (d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
const monthYear = (d) => (d ? d.toLocaleDateString([], { month: "short", year: "numeric" }) : "");

const dayLabel = (d) => {
  if (!d) return "Today";
  const today = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
};

const STATUS_TEXT = { active: "Available", sold: "Sold", paused: "Paused", removed: "Removed" };

// One conversation about one item (stage 15b). Live messages, text only here;
// meeting proposals are shown read-only until 15d adds the buttons.
export default function Chat() {
  const { convId } = useParams();
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [conv, setConv] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [other, setOther] = useState(null);
  const [item, setItem] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");

  const listRef = useRef(null);
  const nearBottom = useRef(true);
  const inputRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/login");
      else setUid(user.uid);
    });
    return () => unsub();
  }, [navigate]);

  // The conversation itself (live: preview + read times).
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, "conversations", convId),
      (snap) => {
        if (!snap.exists() || !(snap.data().participants || []).includes(uid)) {
          setNotFound(true);
          return;
        }
        setConv({ id: snap.id, ...snap.data({ serverTimestamps: "estimate" }) });
      },
      (err) => {
        console.error("Conversation load failed:", err);
        setNotFound(true);
      }
    );
    return () => unsub();
  }, [uid, convId]);

  // The other person and the item (once per conversation).
  const otherId = conv ? (conv.buyerId === uid ? conv.sellerId : conv.buyerId) : null;
  const itemKey = conv ? `${conv.itemType}/${conv.itemId}` : null;
  useEffect(() => {
    if (!otherId) return;
    getDoc(doc(db, "publicProfiles", otherId))
      .then((s) => setOther(s.exists() ? s.data() : {}))
      .catch(() => setOther({}));
  }, [otherId]);
  useEffect(() => {
    if (!itemKey) return;
    const [type, id] = itemKey.split("/");
    getDoc(doc(db, type === "listing" ? "listings" : "services", id))
      .then((s) => setItem(s.exists() ? { id: s.id, ...s.data() } : { missing: true }))
      .catch(() => setItem({ missing: true }));
  }, [itemKey]);

  // Messages, live, oldest → newest.
  const isParticipant = !!conv;
  useEffect(() => {
    if (!isParticipant) return;
    const q = query(
      collection(db, "conversations", convId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(300)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            return { id: d.id, ...x, at: x.createdAt?.toDate?.() ?? null };
          })
        );
        setLoadingMsgs(false);
      },
      (err) => {
        console.error("Messages load failed:", err);
        setLoadingMsgs(false);
      }
    );
    return () => unsub();
  }, [isParticipant, convId]);

  // Mark read whenever something new from the other person is on screen.
  useEffect(() => {
    if (!conv || !uid || !isConversationUnread(conv, uid)) return;
    const mark = () => {
      if (document.visibilityState === "visible") {
        markConversationRead({ conv, uid }).catch((e) => console.error("Mark read failed:", e));
      }
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [conv, uid]);

  // Keep the newest message in view (unless the user scrolled up to read).
  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);
  const onScroll = () => {
    const el = listRef.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const trimmed = text.trim();
  const canSend = !!conv && trimmed.length > 0 && trimmed.length <= MESSAGE_MAX && !sending;

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!canSend) return;
    setSending(true);
    setSendErr("");
    try {
      nearBottom.current = true;
      await sendText({ conv, uid, text });
      setText("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Send failed:", err);
      setSendErr("Couldn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) handleSend(e);
  };

  // Group messages under day headings.
  const groups = useMemo(() => {
    const out = [];
    for (const m of messages) {
      const label = dayLabel(m.at);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(m);
    }
    return out;
  }, [messages]);

  if (notFound) {
    return (
      <Frame>
        <div className="m-auto max-w-sm px-6 text-center">
          <HiOutlineExclamationTriangle className="mx-auto h-7 w-7 text-red-300/70" />
          <h1 className="mt-3 text-lg font-semibold text-white" style={inter}>Chat not found</h1>
          <p className="mt-1 text-sm text-white/45">It doesn't exist, or you're not part of it.</p>
          <Link to="/dashboard" className="mt-5 inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/80 hover:bg-white/[0.09]">
            Back to Dashboard
          </Link>
        </div>
      </Frame>
    );
  }

  const isListing = conv?.itemType === "listing";
  const itemPath = conv ? `/${isListing ? "marketplace" : "services"}/${conv.itemId}` : "/dashboard";
  const otherName = other?.name?.trim() || "Student";
  const otherPhoto = /^https?:\/\//i.test(other?.photo || "") ? other.photo : "";
  const since = other?.memberSince?.toDate?.() ?? null;
  const subline = [other?.department?.trim(), since ? `Member since ${monthYear(since)}` : ""].filter(Boolean).join(" · ");
  const roleLabel = conv ? (conv.buyerId === uid ? (isListing ? "Seller" : "Provider") : "Interested") : "";
  const itemPhoto = item?.photos?.[0] || "";

  return (
    <Frame>
      {/* ── Header ── */}
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] bg-[#0f0c08]/90 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(itemPath))}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#d6bd97] transition-colors hover:bg-white/[0.06]"
        >
          <HiOutlineArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-[#f4e6cd]"
            style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
          >
            {otherPhoto ? <img src={otherPhoto} alt="" className="h-full w-full object-cover" /> : otherName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold text-white" style={inter}>{conv ? otherName : " "}</h1>
              {roleLabel && (
                <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  {roleLabel}
                </span>
              )}
            </div>
            {subline && <p className="truncate text-xs text-white/40">{subline}</p>}
          </div>
        </div>

        {/* Item chip */}
        {conv && (
          <Link
            to={itemPath}
            className="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1.5 pr-3 transition-colors hover:border-[#c9963f]/40 sm:w-auto sm:max-w-[300px]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#090704] text-white/25">
              {itemPhoto ? (
                <img src={itemPhoto} alt="" className="h-full w-full object-cover" />
              ) : isListing ? (
                <HiOutlineShoppingBag className="h-5 w-5" />
              ) : (
                <HiOutlineWrenchScrewdriver className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-white">{item?.title || conv.itemTitle}</span>
              <span className="block truncate text-[11px] text-white/45">
                {item?.missing
                  ? "No longer available"
                  : item
                  ? `Ks ${formatKs(item.price)} · ${STATUS_TEXT[item.status] || "Available"}`
                  : "…"}
              </span>
            </span>
          </Link>
        )}
      </header>

      {/* ── Safety note (wireframe ④) ── */}
      <div className="flex items-start gap-2 border-b border-[#c9963f]/15 bg-[#c9963f]/[0.06] px-4 py-2 sm:px-6">
        <HiOutlineShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#d6bd97]" />
        <p className="text-xs leading-relaxed text-[#f4e6cd]/70">
          Meet in a public campus location during opening hours. Don't share your home address or pay in advance.
        </p>
      </div>

      {/* ── Messages ── */}
      <div ref={listRef} onScroll={onScroll} className="ch-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" aria-live="polite">
        {!conv || loadingMsgs ? (
          <div className="space-y-3">
            {[60, 40, 70].map((w, i) => (
              <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                <div className="h-10 animate-pulse rounded-2xl bg-white/[0.05]" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-white/70">Say hello to {otherName.split(" ")[0]}</p>
            <p className="mt-1 max-w-xs text-sm text-white/40">
              Ask about the {isListing ? "item" : "service"}, the price, or when to meet.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {groups.map((g) => (
              <div key={g.label + g.items[0].id} className="flex flex-col gap-1.5">
                <div className="my-2 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/[0.07]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">{g.label}</span>
                  <span className="h-px flex-1 bg-white/[0.07]" />
                </div>
                {g.items.map((m) => (
                  <Bubble key={m.id} m={m} mine={m.senderId === uid} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Composer ── */}
      <form onSubmit={handleSend} className="border-t border-white/[0.07] bg-[#0f0c08]/90 px-3 py-3 backdrop-blur sm:px-6">
        {sendErr && <p className="mb-2 text-xs text-red-300">{sendErr}</p>}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX + 50))}
            onKeyDown={onKeyDown}
            placeholder="Write a message…"
            disabled={!conv}
            className="ch-scroll max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#d6bd97]/20 bg-[#090704]/80 px-4 py-2.5 text-sm text-[#f4e6cd] outline-none transition placeholder:text-white/30 focus:border-[#c9963f] focus:shadow-[0_0_0_4px_rgba(201,150,63,0.15)] [field-sizing:content]"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8f774b] to-[#c9963f] text-[#f4e6cd] shadow-[0_8px_20px_rgba(143,119,75,0.35)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <HiOutlinePaperAirplane className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto mt-1 flex max-w-3xl justify-between px-1 text-[10px] text-white/30">
          <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
          {trimmed.length > MESSAGE_MAX - 200 && (
            <span className={trimmed.length > MESSAGE_MAX ? "text-red-300" : ""}>
              {trimmed.length}/{MESSAGE_MAX}
            </span>
          )}
        </div>
      </form>
    </Frame>
  );
}

// Full-height column inside the app shell (phones leave room for the tab bar).
function Frame({ children }) {
  return (
    <div
      className="relative flex h-[calc(100dvh-76px-env(safe-area-inset-bottom,0px))] flex-col bg-[#0d0b07] text-white md:h-[100dvh]"
      style={inter}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(600px 300px at 100% 0%, rgba(201,150,63,0.08), transparent 70%)" }}
        aria-hidden="true"
      />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function Bubble({ m, mine }) {
  if (m.type === "meeting") {
    const when = m.meetAt?.toDate?.();
    const status = { pending: "Waiting for a reply", accepted: "Accepted", declined: "Declined", cancelled: "Cancelled" }[m.status] || "";
    return (
      <div className={`flex ${mine ? "justify-end" : ""}`}>
        <div className="w-full max-w-[320px] rounded-2xl border border-[#c9963f]/30 bg-[#c9963f]/[0.07] p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#d6bd97]">Meeting proposal</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-white">
            <HiOutlineMapPin className="h-4 w-4 text-[#d6bd97]" /> {spotLabel(m.spot)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/80">
            <HiOutlineCalendarDays className="h-4 w-4 text-[#d6bd97]" />
            {when ? when.toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
          </p>
          <p className="mt-2 text-xs text-white/45">{status}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex ${mine ? "justify-end" : ""}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 sm:max-w-[65%] ${
          mine
            ? "rounded-br-md bg-gradient-to-br from-[#a8874f] to-[#c9963f] text-[#1a120a]"
            : "rounded-bl-md border border-white/[0.08] bg-white/[0.06] text-[#f4e6cd]"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{m.text}</p>
        <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-[#1a120a]/55" : "text-white/35"}`}>{timeOfDay(m.at)}</p>
      </div>
    </div>
  );
}
