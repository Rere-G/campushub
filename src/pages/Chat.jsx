import { useEffect, useMemo, useRef, useState } from "react";
import { usePageTitle } from "../utils/pageTitle";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowUturnLeft,
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCheck,
  HiOutlineEllipsisVertical,
  HiOutlineFlag,
  HiOutlineExclamationTriangle,
  HiOutlineFaceSmile,
  HiOutlineMapPin,
  HiOutlinePaperAirplane,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineShieldCheck,
  HiOutlineShoppingBag,
  HiOutlineTrash,
  HiOutlineWrenchScrewdriver,
  HiOutlineXMark,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import { ReportDialog } from "../components/ReportButton";
import { hasReportedChat, submitChatReport } from "../utils/reports";
import { currencyOf, formatPostPrice, formatPrice } from "../utils/postDetails";
import {
  MEETING_SPOTS,
  MEET_MAX_DAYS,
  MESSAGE_MAX,
  OFFER_MAX,
  REACTIONS,
  TYPING_PING_MS,
  TYPING_SHOW_MS,
  answerProposal,
  canEdit,
  deleteMessage,
  editMessage,
  isConversationUnread,
  markConversationRead,
  pingTyping,
  quickMessages,
  reactionEmoji,
  meetWhenText,
  sendMeeting,
  sendOffer,
  sendText,
  setReaction,
  spotLabel,
} from "../utils/chat";

const inter = { fontFamily: "'Inter', sans-serif" };
const timeOfDay = (d) => (d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
const monthYear = (d) => (d ? d.toLocaleDateString([], { month: "short", year: "numeric" }) : "");
const GROUP_GAP_MS = 5 * 60 * 1000;

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

// One conversation about one item. Stage 15d: grouped bubbles, start-of-chat
// item card, sold/removed banner, suggestions, reply, reactions, edit/delete.
export default function Chat() {
  const { convId } = useParams();
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [conv, setConv] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [other, setOther] = useState(null);
  usePageTitle(other?.name?.trim() ? `Chat with ${other.name.trim()}` : "Messages");
  const [item, setItem] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [replyTo, setReplyTo] = useState(null); // message being answered
  const [editing, setEditing] = useState(null); // message being edited
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sheetFor, setSheetFor] = useState(null); // phone long-press menu
  const [highlightId, setHighlightId] = useState(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [meetOpen, setMeetOpen] = useState(false);
  const [meetSpot, setMeetSpot] = useState("library");
  const [meetDate, setMeetDate] = useState("");
  const [meetTime, setMeetTime] = useState("14:00");
  const [moreOpen, setMoreOpen] = useState(false); // phone "+" menu
  const [headerMenu, setHeaderMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const lastPing = useRef(0);
  const typingTimer = useRef(null);
  // "Now", refreshed every 30 s, so Edit disappears when the 15-minute window ends.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

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

  const otherId = conv ? (conv.buyerId === uid ? conv.sellerId : conv.buyerId) : null;
  const itemKey = conv ? `${conv.itemType}/${conv.itemId}` : null;
  useEffect(() => {
    if (!otherId) return;
    getDoc(doc(db, "publicProfiles", otherId))
      .then((s) => setOther(s.exists() ? s.data() : {}))
      .catch(() => setOther({}));
  }, [otherId]);
  // The item, live, so a "sold"/"removed" change shows up in the chat.
  useEffect(() => {
    if (!itemKey) return;
    const [type, id] = itemKey.split("/");
    const unsub = onSnapshot(
      doc(db, type === "listing" ? "listings" : "services", id),
      (s) => setItem(s.exists() ? { id: s.id, ...s.data() } : { missing: true }),
      () => setItem({ missing: true })
    );
    return () => unsub();
  }, [itemKey]);

  const isParticipant = !!conv;
  useEffect(() => {
    if (!isParticipant) return;
    const q = query(collection(db, "conversations", convId, "messages"), orderBy("createdAt", "asc"), limitToLast(300));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          return { id: d.id, ...x, at: x.createdAt?.toDate?.() ?? null };
        });
        setMessages(list);
        // Their message arrived, so they've stopped typing.
        if (list.length && list[list.length - 1].senderId !== uid) {
          clearTimeout(typingTimer.current);
          setOtherTyping(false);
        }
        setLoadingMsgs(false);
      },
      (err) => {
        console.error("Messages load failed:", err);
        setLoadingMsgs(false);
      }
    );
    return () => unsub();
  }, [isParticipant, convId, uid]);

  // "… is typing": show for a few seconds after each of their pings.
  // The first snapshot only counts if its ping is recent; later ones always do
  // (so a clock difference between phones can't hide it).
  useEffect(() => {
    if (!isParticipant || !otherId) return;
    let first = true;
    const show = (ms) => {
      clearTimeout(typingTimer.current);
      setOtherTyping(true);
      typingTimer.current = setTimeout(() => setOtherTyping(false), ms);
    };
    const unsub = onSnapshot(
      doc(db, "conversations", convId, "typing", otherId),
      (snap) => {
        const at = snap.exists() ? snap.data({ serverTimestamps: "estimate" }).at?.toDate?.() : null;
        if (at) {
          if (!first) show(TYPING_SHOW_MS);
          else {
            const age = Date.now() - at.getTime();
            if (age >= 0 && age < TYPING_SHOW_MS) show(TYPING_SHOW_MS - age);
          }
        }
        first = false;
      },
      () => {}
    );
    return () => {
      unsub();
      clearTimeout(typingTimer.current);
    };
  }, [isParticipant, otherId, convId]);

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

  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, otherTyping]);
  const onScroll = () => {
    const el = listRef.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // Have I already reported this chat? (one report per chat per person)
  const convIdForReport = conv?.id;
  useEffect(() => {
    if (!uid || !convIdForReport) return;
    let alive = true;
    hasReportedChat(uid, convIdForReport)
      .then((r) => alive && setReported(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid, convIdForReport]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const latestId = messages.length ? messages[messages.length - 1].id : null;
  const trimmed = text.trim();
  const canSend = !!conv && trimmed.length > 0 && trimmed.length <= MESSAGE_MAX && !sending;

  const send = async (body) => {
    const value = (body ?? text).trim();
    if (!conv || !value || value.length > MESSAGE_MAX || sending) return;
    setSending(true);
    try {
      nearBottom.current = true;
      if (editing && body === undefined) {
        if (!canEdit(editing, uid)) {
          setNotice("You can only edit a message for 15 minutes after sending it.");
        } else {
          await editMessage({ conv, uid, msg: editing, text: value, isLatest: editing.id === latestId });
        }
        setEditing(null);
        setText("");
      } else {
        await sendText({ conv, uid, text: value, replyTo });
        setReplyTo(null);
        if (body === undefined) setText("");
      }
      setShowSuggestions(false);
      inputRef.current?.focus();
    } catch (err) {
      console.error("Send failed:", err);
      setNotice("Couldn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const onTextChange = (e) => {
    const value = e.target.value.slice(0, MESSAGE_MAX + 50);
    setText(value);
    if (conv && uid && value.trim() && !editing && Date.now() - lastPing.current > TYPING_PING_MS) {
      lastPing.current = Date.now();
      pingTyping({ convId: conv.id, uid }).catch(() => {});
    }
  };

  const offerValue = Number(String(offerAmount).replace(/[^0-9]/g, ""));
  const offerOk = Number.isInteger(offerValue) && offerValue >= 1 && offerValue <= OFFER_MAX;
  const closePanels = () => {
    setShowSuggestions(false);
    setOfferOpen(false);
    setMeetOpen(false);
    setMoreOpen(false);
  };
  const toggleSuggestions = () => {
    const next = !showSuggestions;
    closePanels();
    setShowSuggestions(next);
  };
  const openMeet = () => {
    const next = !meetOpen;
    closePanels();
    if (next && !meetDate) {
      const t = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setMeetDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
    }
    setMeetOpen(next);
  };
  const openOffer = () => {
    const next = !offerOpen;
    closePanels();
    setOfferAmount(item && !item.missing && item.price ? String(item.price) : "");
    setOfferOpen(next);
  };
  const submitOffer = async () => {
    if (!offerOk || sending) return;
    setSending(true);
    try {
      nearBottom.current = true;
      await sendOffer({ conv, uid, amount: offerValue, currency: currencyOf(item) });
      setOfferOpen(false);
      setOfferAmount("");
    } catch (err) {
      console.error("Offer failed:", err);
      setNotice("Couldn't send the offer. Try again.");
    } finally {
      setSending(false);
    }
  };
  // Meetup: a fixed spot + a date/time between now and 60 days ahead.
  const meetAt = meetDate && meetTime ? new Date(`${meetDate}T${meetTime}`) : null;
  const meetOk =
    !!meetAt && !Number.isNaN(meetAt.getTime()) &&
    meetAt.getTime() > now + 5 * 60 * 1000 &&
    meetAt.getTime() < now + (MEET_MAX_DAYS * 24 - 1) * 60 * 60 * 1000;
  const toDateInput = (ms) => {
    const t = new Date(ms);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  };
  const submitMeet = async () => {
    if (!meetOk || sending) return;
    setSending(true);
    try {
      nearBottom.current = true;
      await sendMeeting({ conv, uid, spot: meetSpot, meetAt });
      setMeetOpen(false);
    } catch (err) {
      console.error("Meetup failed:", err);
      setNotice("Couldn't send the meetup proposal. Try again.");
    } finally {
      setSending(false);
    }
  };

  const answer = async (m, status) => {
    try {
      await answerProposal({ convId: conv.id, msgId: m.id, status });
    } catch (err) {
      console.error("Answer failed:", err);
      setNotice("Couldn't update that. It may already have been answered.");
    }
  };

  // The report copies the other person's latest live text message.
  const reportTarget = [...messages].reverse().find((m) => m.senderId !== uid && m.type === "text" && !m.deleted) || null;
  const openReport = () => {
    setHeaderMenu(false);
    if (reported) return;
    if (!reportTarget) {
      setNotice("There's no message from them to report yet.");
      return;
    }
    setReportOpen(true);
  };
  const submitReportNow = async (reason, note) => {
    try {
      await submitChatReport({ uid, conv, msg: reportTarget, reason, note });
      setReported(true);
      setReportOpen(false);
      setNotice("Thanks. An admin will review this chat.");
      return null;
    } catch (err) {
      console.error("Chat report failed:", err);
      try {
        if (await hasReportedChat(uid, conv.id)) {
          setReported(true);
          setReportOpen(false);
          setNotice("You've already reported this chat.");
          return null;
        }
      } catch {
        /* fall through */
      }
      return "Couldn't send your report. If they just deleted that message, try again.";
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send();
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
    if (e.key === "Escape" && (editing || replyTo)) {
      if (editing) setText("");
      setEditing(null);
      setReplyTo(null);
    }
  };

  const startReply = (m) => {
    if (editing) setText("");
    setEditing(null);
    setReplyTo(m);
    setSheetFor(null);
    inputRef.current?.focus();
  };
  const startEdit = (m) => {
    setSheetFor(null);
    if (!canEdit(m, uid)) {
      setNotice("You can only edit a message for 15 minutes after sending it.");
      return;
    }
    setReplyTo(null);
    setEditing(m);
    setText(m.text);
    inputRef.current?.focus();
  };
  const doDelete = async (m) => {
    setSheetFor(null);
    try {
      await deleteMessage({ conv, uid, msg: m, isLatest: m.id === latestId });
      if (editing?.id === m.id) {
        setEditing(null);
        setText("");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      setNotice("Couldn't delete that message. Try again.");
    }
  };
  const react = async (m, key) => {
    setSheetFor(null);
    try {
      await setReaction({ convId: conv.id, msgId: m.id, uid, current: m.reactions?.[uid], next: key });
    } catch (err) {
      console.error("Reaction failed:", err);
      setNotice("Couldn't add the reaction. Try again.");
    }
  };
  const jumpTo = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1600);
  };

  // Day headings, and runs of text messages from one person a few minutes apart.
  const days = useMemo(() => {
    const out = [];
    let prev = null;
    for (const m of messages) {
      const label = dayLabel(m.at);
      if (!out.length || out[out.length - 1].label !== label) {
        out.push({ label, runs: [] });
        prev = null;
      }
      const runs = out[out.length - 1].runs;
      const joins =
        prev && prev.senderId === m.senderId && m.type === "text" && prev.type === "text" &&
        m.at && prev.at && m.at - prev.at < GROUP_GAP_MS;
      if (joins) runs[runs.length - 1].items.push(m);
      else runs.push({ senderId: m.senderId, items: [m] });
      prev = m;
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
  const isBuyer = conv?.buyerId === uid;
  const noun = isListing ? "listing" : "service";
  const itemPath = conv ? `/${isListing ? "marketplace" : "services"}/${conv.itemId}` : "/dashboard";
  const otherName = other?.name?.trim() || "Student";
  const otherFirst = otherName.split(" ")[0];
  const otherPhoto = /^https?:\/\//i.test(other?.photo || "") ? other.photo : "";
  const since = other?.memberSince?.toDate?.() ?? null;
  const subline =
    [other?.department?.trim(), since ? `Member since ${monthYear(since)}` : ""].filter(Boolean).join(" · ") ||
    (other ? "CampusHub member" : "");
  const roleLabel = conv ? (isBuyer ? (isListing ? "Seller" : "Provider") : "Interested") : "";
  const itemPhoto = item?.photos?.[0] || "";
  const itemTitle = item?.title || conv?.itemTitle || "";
  const itemState = item?.missing ? "removed" : item?.status || "active";
  const suggestions = conv ? quickMessages({ isBuyer, isListing }) : [];
  const nameOf = (id) => (id === uid ? "You" : otherFirst);
  // "Sent" / "Seen" under my message when it's the latest in the chat.
  const latest = messages[messages.length - 1];
  const otherReadAt = conv ? conv[conv.buyerId === uid ? "sellerReadAt" : "buyerReadAt"]?.toDate?.() ?? null : null;
  const receiptFor =
    latest && latest.senderId === uid && !latest.deleted
      ? { id: latest.id, text: otherReadAt && latest.at && otherReadAt >= latest.at ? "Seen" : "Sent" }
      : null;

  return (
    <Frame>
      {/* ── Header ── */}
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] bg-[#0f0c08]/90 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          aria-label="Back to messages"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#d6bd97] transition-colors hover:bg-white/[0.06] md:hidden"
        >
          <HiOutlineArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={otherName} photo={otherPhoto} size="h-10 w-10" />
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
        {conv && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setHeaderMenu((v) => !v)}
              aria-label="Chat options"
              aria-haspopup="menu"
              aria-expanded={headerMenu}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <HiOutlineEllipsisVertical className="h-5 w-5" />
            </button>
            {headerMenu && (
              <>
                <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setHeaderMenu(false)} />
                <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#15110b] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openReport}
                    disabled={reported}
                    className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-default disabled:text-white/40 disabled:hover:bg-transparent"
                  >
                    <HiOutlineFlag className="h-4 w-4" />
                    {reported ? "You reported this chat" : "Report this chat"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {conv && (
          <Link
            to={itemPath}
            className="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1.5 pr-3 transition-colors hover:border-[#c9963f]/40 sm:w-auto sm:max-w-[300px]"
          >
            <ItemThumb photo={itemPhoto} isListing={isListing} size="h-10 w-10" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-white">{itemTitle}</span>
              <span className="block truncate text-[11px] text-white/45">
                {item?.missing ? "No longer available" : item ? `${formatPostPrice(item)} · ${STATUS_TEXT[item.status] || "Available"}` : "…"}
              </span>
            </span>
          </Link>
        )}
      </header>

      {/* ── Safety note + item status ── */}
      <div className="flex items-start gap-2 border-b border-[#c9963f]/15 bg-[#c9963f]/[0.06] px-4 py-2 sm:px-6">
        <HiOutlineShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#d6bd97]" />
        <p className="text-xs leading-relaxed text-[#f4e6cd]/70">
          Meet in a public campus location during opening hours. Don't share your home address or pay in advance.
        </p>
      </div>
      {conv && item && itemState !== "active" && (
        <div className="border-b border-white/[0.07] bg-white/[0.03] px-4 py-2 text-center text-xs text-white/55 sm:px-6">
          {itemState === "sold"
            ? "This listing was marked sold. You can still message each other to wrap up."
            : itemState === "paused"
            ? "This service is paused for now."
            : `This ${noun} was removed and is no longer visible to others.`}
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={listRef} onScroll={onScroll} className="ch-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite">
        <div className="mx-auto flex max-w-3xl flex-col">
          {conv && (
            <div className="mx-auto mb-5 w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
              <div className="mx-auto w-fit">
                <ItemThumb photo={itemPhoto} isListing={isListing} size="h-20 w-20" rounded="rounded-xl" />
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-white">{itemTitle}</p>
              {item && !item.missing && <p className="mt-0.5 text-sm font-semibold text-[#d6bd97]">{formatPostPrice(item)}</p>}
              <p className="mt-2 text-xs text-white/40">You're chatting with {otherFirst} about this {noun}.</p>
            </div>
          )}

          {!conv || loadingMsgs ? (
            <div className="space-y-3">
              {[60, 40, 70].map((w, i) => (
                <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                  <div className="h-10 animate-pulse rounded-2xl bg-white/[0.05]" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <SuggestionList title={`Start the conversation with ${otherFirst}`} items={suggestions} onPick={(t) => send(t)} disabled={sending} />
          ) : (
            days.map((day) => (
              <div key={day.label + day.runs[0].items[0].id} className="flex flex-col">
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/[0.07]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">{day.label}</span>
                  <span className="h-px flex-1 bg-white/[0.07]" />
                </div>
                {day.runs.map((run) => {
                  const mine = run.senderId === uid;
                  return (
                    <div key={run.items[0].id} className={`mb-3 flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
                      {!mine && (
                        <div className="w-7 shrink-0 pb-0.5">
                          <Avatar name={otherName} photo={otherPhoto} size="h-7 w-7" text="text-[11px]" />
                        </div>
                      )}
                      <div className={`flex min-w-0 max-w-[82%] flex-col gap-0.5 sm:max-w-[68%] ${mine ? "items-end" : "items-start"}`}>
                        {run.items.map((m, i) => (
                          <MessageRow
                            key={m.id}
                            m={m}
                            uid={uid}
                            now={now}
                            mine={mine}
                            first={i === 0}
                            last={i === run.items.length - 1}
                            highlighted={highlightId === m.id}
                            nameOf={nameOf}
                            onReply={() => startReply(m)}
                            onEdit={() => startEdit(m)}
                            onDelete={() => doDelete(m)}
                            onReact={(k) => react(m, k)}
                            onLongPress={() => !m.deleted && setSheetFor(m)}
                            onJump={jumpTo}
                            onAnswer={(st) => answer(m, st)}
                            onProposeMeetup={() => !meetOpen && openMeet()}
                            receipt={receiptFor?.id === m.id ? receiptFor.text : ""}
                            currency={currencyOf(item)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          {otherTyping && (
            <div className="mb-2 flex items-center gap-2" aria-live="polite">
              <Avatar name={otherName} photo={otherPhoto} size="h-7 w-7" text="text-[11px]" />
              <span className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs italic text-white/50">
                {otherFirst} is typing…
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Composer ── */}
      <form onSubmit={onSubmit} className="relative border-t border-white/[0.07] bg-[#0f0c08]/95 px-3 py-3 backdrop-blur sm:px-6">
        {notice && <p className="mx-auto mb-2 max-w-3xl text-xs text-red-300">{notice}</p>}

        {showSuggestions && messages.length > 0 && (
          <div className="mx-auto mb-2 max-w-3xl">
            <SuggestionList items={suggestions} onPick={(t) => send(t)} disabled={sending} compact />
          </div>
        )}

        {meetOpen && (
          <div className="mx-auto mb-2 max-w-3xl rounded-2xl border border-white/[0.08] bg-[#15110b] p-3">
            <p className="text-sm font-semibold text-white/85">Propose a meetup</p>
            <fieldset className="mt-2">
              <legend className="sr-only">Place</legend>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {MEETING_SPOTS.map((sp) => (
                  <label
                    key={sp.key}
                    className={`flex h-10 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm transition-colors ${
                      meetSpot === sp.key ? "border-[#c9963f]/60 bg-[#c9963f]/10 text-[#f4e6cd]" : "border-white/10 text-white/65 hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="meet-spot"
                      value={sp.key}
                      checked={meetSpot === sp.key}
                      onChange={() => setMeetSpot(sp.key)}
                      className="accent-[#c9963f]"
                    />
                    {sp.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-2.5 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Date
                <input
                  id="meet-date"
                  type="date"
                  value={meetDate}
                  min={toDateInput(now)}
                  max={toDateInput(now + (MEET_MAX_DAYS - 1) * 24 * 60 * 60 * 1000)}
                  onChange={(e) => setMeetDate(e.target.value)}
                  className="h-10 rounded-xl border border-[#d6bd97]/20 bg-[#090704]/80 px-3 text-sm text-[#f4e6cd] outline-none [color-scheme:dark] focus:border-[#c9963f]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Time
                <input
                  id="meet-time"
                  type="time"
                  value={meetTime}
                  onChange={(e) => setMeetTime(e.target.value)}
                  className="h-10 rounded-xl border border-[#d6bd97]/20 bg-[#090704]/80 px-3 text-sm text-[#f4e6cd] outline-none [color-scheme:dark] focus:border-[#c9963f]"
                />
              </label>
              <div className="ml-auto flex gap-1">
                <button type="button" onClick={() => setMeetOpen(false)} className="h-10 px-2 text-sm text-white/50 hover:text-white">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitMeet}
                  disabled={!meetOk || sending}
                  className="h-10 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-4 text-sm font-semibold text-[#f4e6cd] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send proposal
                </button>
              </div>
            </div>
            {meetAt && !meetOk && (
              <p className="mt-2 text-xs text-red-300">Pick a time from now up to {MEET_MAX_DAYS} days ahead.</p>
            )}
            <p className="mt-2 flex items-start gap-1.5 text-xs text-[#f4e6cd]/55">
              <HiOutlineShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d6bd97]" />
              Meet in a public campus location during opening hours. Do not share your address.
            </p>
          </div>
        )}

        {moreOpen && (
          <ul className="mx-auto mb-2 max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15110b] md:hidden">
            {[
              { label: "Make an offer", onClick: openOffer },
              { label: "Propose a meetup", onClick: openMeet },
              ...(messages.length > 0 ? [{ label: "Suggestions", onClick: toggleSuggestions }] : []),
            ].map((o, i) => (
              <li key={o.label} className={i ? "border-t border-white/[0.06]" : ""}>
                <button type="button" onClick={o.onClick} className="w-full px-4 py-3 text-left text-sm text-[#f4e6cd]/85 hover:bg-white/[0.05]">
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {offerOpen && (
          <div className="mx-auto mb-2 max-w-3xl rounded-2xl border border-white/[0.08] bg-[#15110b] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="offer-amount" className="text-sm font-semibold text-white/80">Your offer</label>
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-xl border border-[#d6bd97]/20 bg-[#090704]/80 px-3 focus-within:border-[#c9963f]">
                <span className="mr-2 text-sm text-white/40">{currencyOf(item) === "USD" ? "$" : "Ks"}</span>
                <input
                  id="offer-amount"
                  inputMode="numeric"
                  value={offerAmount ? Number(String(offerAmount).replace(/[^0-9]/g, "") || 0).toLocaleString("en-US") : ""}
                  onChange={(e) => setOfferAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitOffer())}
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#f4e6cd] outline-none"
                />
              </div>
              <button
                type="button"
                onClick={submitOffer}
                disabled={!offerOk || sending}
                className="h-10 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-4 text-sm font-semibold text-[#f4e6cd] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send offer
              </button>
              <button type="button" onClick={() => setOfferOpen(false)} className="h-10 px-2 text-sm text-white/50 hover:text-white">
                Cancel
              </button>
            </div>
            {item && !item.missing && item.price ? (
              <p className="mt-2 text-xs text-white/40">Asking price: {formatPostPrice(item)}</p>
            ) : null}
          </div>
        )}

        {(replyTo || editing) && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-[#d6bd97]">
                {editing ? "Editing message" : `Replying to ${replyTo.senderId === uid ? "yourself" : otherFirst}`}
              </p>
              <p className="truncate text-xs text-white/50">{(editing || replyTo).text}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (editing) setText("");
                setEditing(null);
                setReplyTo(null);
              }}
              aria-label="Cancel"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white"
            >
              <HiOutlineXMark className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mx-auto flex max-w-3xl items-end gap-2">
          {!editing && conv && (
            <>
              {/* Phone: one "+" opens the same choices as rows */}
              <button
                type="button"
                onClick={() => {
                  const next = !moreOpen;
                  closePanels();
                  setMoreOpen(next);
                }}
                aria-label="More: offer, meetup, suggestions"
                aria-expanded={moreOpen}
                className={`flex h-11 w-9 shrink-0 items-center justify-center rounded-xl transition-colors md:hidden ${
                  moreOpen ? "text-[#d6bd97]" : "text-white/45"
                }`}
              >
                <HiOutlinePlus className="h-5 w-5" />
              </button>
              {/* Desktop: quiet text buttons */}
              <div className="hidden items-end md:flex">
                <button
                  type="button"
                  onClick={openOffer}
                  aria-expanded={offerOpen}
                  className={`h-11 shrink-0 rounded-xl px-2 text-xs font-semibold transition-colors ${
                    offerOpen ? "text-[#d6bd97]" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  Offer
                </button>
                <button
                  type="button"
                  onClick={openMeet}
                  aria-expanded={meetOpen}
                  className={`h-11 shrink-0 rounded-xl px-2 text-xs font-semibold transition-colors ${
                    meetOpen ? "text-[#d6bd97]" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  Meetup
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSuggestions}
                    aria-expanded={showSuggestions}
                    className={`h-11 shrink-0 rounded-xl px-2 text-xs font-semibold transition-colors ${
                      showSuggestions ? "text-[#d6bd97]" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    Suggestions
                  </button>
                )}
              </div>
            </>
          )}
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={text}
            onChange={onTextChange}
            onKeyDown={onKeyDown}
            placeholder={editing ? "Edit your message…" : "Write a message…"}
            disabled={!conv}
            className="ch-scroll max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#d6bd97]/20 bg-[#090704]/80 px-4 py-2.5 text-sm text-[#f4e6cd] outline-none transition placeholder:text-white/30 focus:border-[#c9963f] focus:shadow-[0_0_0_4px_rgba(201,150,63,0.15)] [field-sizing:content]"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label={editing ? "Save edit" : "Send"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8f774b] to-[#c9963f] text-[#f4e6cd] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {editing ? <HiOutlineCheck className="h-5 w-5" /> : <HiOutlinePaperAirplane className="h-5 w-5" />}
          </button>
        </div>
        <div className="mx-auto mt-1 flex max-w-3xl justify-between px-1 text-[10px] text-white/30">
          <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line · hover a message for options</span>
          {trimmed.length > MESSAGE_MAX - 200 && (
            <span className={trimmed.length > MESSAGE_MAX ? "text-red-300" : ""}>
              {trimmed.length}/{MESSAGE_MAX}
            </span>
          )}
        </div>
      </form>

      {reportOpen && reportTarget && (
        <ReportDialog
          noun="chat"
          subtitle={`Only CampusHub admins see reports, and they can then read this chat. ${otherFirst} isn't told who reported it.`}
          preview={{ label: `Latest message from ${otherFirst}`, text: reportTarget.text }}
          onClose={() => setReportOpen(false)}
          onSubmit={submitReportNow}
        />
      )}

      {sheetFor && (
        <ActionSheet
          m={sheetFor}
          uid={uid}
          now={now}
          onClose={() => setSheetFor(null)}
          onReply={() => startReply(sheetFor)}
          onEdit={() => startEdit(sheetFor)}
          onDelete={() => doDelete(sheetFor)}
          onReact={(k) => react(sheetFor, k)}
        />
      )}
    </Frame>
  );
}

/* ─── Layout + small pieces ───────────────────────────────────── */

function Frame({ children }) {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-[#0d0b07] text-white" style={inter}>
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(600px 300px at 100% 0%, rgba(201,150,63,0.08), transparent 70%)" }}
        aria-hidden="true"
      />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function Avatar({ name, photo, size, text = "text-sm" }) {
  return (
    <span
      className={`${size} ${text} flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-[#f4e6cd]`}
      style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
    >
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
    </span>
  );
}

function ItemThumb({ photo, isListing, size, rounded = "rounded-lg" }) {
  return (
    <span className={`${size} ${rounded} flex shrink-0 items-center justify-center overflow-hidden bg-[#090704] text-white/25`}>
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : isListing ? (
        <HiOutlineShoppingBag className="h-5 w-5" />
      ) : (
        <HiOutlineWrenchScrewdriver className="h-5 w-5" />
      )}
    </span>
  );
}

// Plain rows of ready-made messages. Tapping one sends it.
function SuggestionList({ title, items, onPick, disabled, compact = false }) {
  return (
    <div className={compact ? "" : "mx-auto w-full max-w-sm"}>
      {title && <p className="mb-2 text-center text-xs text-white/40">{title}</p>}
      <ul className={`overflow-hidden rounded-2xl border border-white/[0.08] ${compact ? "bg-[#15110b]" : "bg-white/[0.02]"}`}>
        {items.map((t, i) => (
          <li key={t} className={i ? "border-t border-white/[0.06]" : ""}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(t)}
              className="w-full px-4 py-2.5 text-left text-sm text-[#f4e6cd]/85 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
            >
              {t}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Reaction chips under a bubble; tapping your own removes it.
function ReactionBadges({ reactions, uid, onToggle, mine }) {
  const entries = Object.entries(reactions || {});
  if (!entries.length) return null;
  const counts = {};
  for (const [, key] of entries) counts[key] = (counts[key] || 0) + 1;
  const myKey = reactions?.[uid];
  return (
    <div className={`relative z-10 -mt-1.5 flex gap-1 px-1 ${mine ? "justify-end" : ""}`}>
      {Object.entries(counts).map(([key, n]) => (
        <button
          key={key}
          type="button"
          onClick={() => key === myKey && onToggle(key)}
          aria-label={key === myKey ? "Remove your reaction" : `${n} reaction`}
          className={`flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs ${
            key === myKey ? "border-[#c9963f]/50 bg-[#2a2013]" : "border-white/10 bg-[#15110b]"
          }`}
        >
          <span>{reactionEmoji(key)}</span>
          {n > 1 && <span className="text-[10px] text-white/60">{n}</span>}
        </button>
      ))}
    </div>
  );
}

function MessageRow({ m, uid, now, mine, first, last, highlighted, nameOf, onReply, onEdit, onDelete, onReact, onLongPress, onJump, onAnswer, onProposeMeetup, receipt, currency }) {
  const [reactOpen, setReactOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const press = useRef(null);

  const startPress = (e) => {
    if (e.pointerType !== "touch") return;
    press.current = setTimeout(onLongPress, 450);
  };
  const endPress = () => clearTimeout(press.current);

  if (m.type === "meeting") {
    return <MeetingCard m={m} mine={mine} now={now} nameOf={nameOf} onAnswer={onAnswer} receipt={receipt} />;
  }
  if (m.type === "offer") {
    return <OfferCard m={m} mine={mine} nameOf={nameOf} onAnswer={onAnswer} onProposeMeetup={onProposeMeetup} receipt={receipt} currency={currency} />;
  }
  if (m.type !== "text") return null;

  // Bubbles in one run touch with tighter corners on the sender's side.
  const corners = mine
    ? `rounded-2xl rounded-br-md ${first ? "" : "rounded-tr-md"}`
    : `rounded-2xl rounded-bl-md ${first ? "" : "rounded-tl-md"}`;
  const editable = mine && !m.deleted && !!m.at && now - m.at.getTime() < 15 * 60 * 1000;

  return (
    <div
      id={`msg-${m.id}`}
      className={`group relative flex max-w-full flex-col ${mine ? "items-end" : "items-start"}`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={() => {
        endPress();
        setReactOpen(false);
        setConfirmDelete(false);
      }}
      onPointerCancel={endPress}
    >
      <div className={`flex max-w-full items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
        <div
          className={`${corners} min-w-0 max-w-full select-text px-3.5 py-2 transition-shadow ${
            m.deleted
              ? "border border-white/[0.08] bg-transparent text-white/40"
              : mine
              ? "bg-gradient-to-br from-[#a8874f] to-[#c9963f] text-[#1a120a]"
              : "border border-white/[0.08] bg-white/[0.06] text-[#f4e6cd]"
          } ${highlighted ? "shadow-[0_0_0_2px_rgba(214,189,151,0.8)]" : ""}`}
        >
          {m.replyTo && !m.deleted && (
            <button
              type="button"
              onClick={() => onJump(m.replyTo.id)}
              className={`mb-1.5 block w-full rounded-lg px-2.5 py-1.5 text-left ${mine ? "bg-black/15" : "bg-white/[0.06]"}`}
            >
              <span className={`block text-[11px] font-semibold ${mine ? "text-[#1a120a]/75" : "text-[#d6bd97]"}`}>
                {nameOf(m.replyTo.senderId)}
              </span>
              <span className={`block truncate text-xs ${mine ? "text-[#1a120a]/65" : "text-white/50"}`}>
                {m.replyTo.text || "Deleted message"}
              </span>
            </button>
          )}
          {m.deleted ? (
            <p className="text-[13px] italic">{m.removedByAdmin ? "This message was removed by a moderator" : "This message was deleted"}</p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{m.text}</p>
          )}
          {/* Time on the last bubble of a run; "edited" on any edited bubble. */}
          {(last || (m.editedAt && !m.deleted)) && (
            <p className={`mt-0.5 text-right text-[10px] ${mine && !m.deleted ? "text-[#1a120a]/55" : "text-white/35"}`}>
              {m.editedAt && !m.deleted ? (last ? "edited · " : "edited") : ""}
              {last ? timeOfDay(m.at) : ""}
            </p>
          )}
        </div>

        {/* Desktop: actions appear beside the bubble on hover / keyboard focus */}
        {!m.deleted && (
          <div className="relative hidden shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-[#15110b] p-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:flex">
            <IconBtn label="Reply" onClick={onReply}><HiOutlineArrowUturnLeft className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="React" onClick={() => setReactOpen((v) => !v)}><HiOutlineFaceSmile className="h-3.5 w-3.5" /></IconBtn>
            {editable && <IconBtn label="Edit" onClick={onEdit}><HiOutlinePencil className="h-3.5 w-3.5" /></IconBtn>}
            {mine &&
              (confirmDelete ? (
                <span className="flex items-center gap-1 px-1">
                  <button type="button" onClick={onDelete} className="rounded-full bg-red-500/80 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="px-1 text-[11px] text-white/50">
                    Keep
                  </button>
                </span>
              ) : (
                <IconBtn label="Delete" onClick={() => setConfirmDelete(true)}><HiOutlineTrash className="h-3.5 w-3.5" /></IconBtn>
              ))}
            {reactOpen && (
              <div className={`absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full border border-white/10 bg-[#15110b] p-1 shadow-lg ${mine ? "right-0" : "left-0"}`}>
                {REACTIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    aria-label={r.label}
                    onClick={() => {
                      setReactOpen(false);
                      onReact(r.key);
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform hover:scale-110 ${
                      m.reactions?.[uid] === r.key ? "bg-[#c9963f]/20" : ""
                    }`}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {!m.deleted && <ReactionBadges reactions={m.reactions} uid={uid} mine={mine} onToggle={onReact} />}
      {receipt && <p className="mt-0.5 px-1 text-[10px] text-white/35">{receipt}</p>}
    </div>
  );
}

// Meetup proposal. The other person accepts/declines; the sender may cancel.
// A pending proposal whose time has passed shows as expired (no buttons).
function MeetingCard({ m, mine, now, nameOf, onAnswer, receipt }) {
  const [busy, setBusy] = useState(false);
  const act = async (status) => {
    setBusy(true);
    await onAnswer(status);
    setBusy(false);
  };
  const when = m.meetAt?.toDate?.() ?? null;
  const expired = m.status === "pending" && when && when.getTime() < now;
  const statusText = expired
    ? "Expired. Propose a new time."
    : {
        pending: mine ? "Waiting for a reply" : `${nameOf(m.senderId)} proposed a meetup`,
        accepted: "Meetup confirmed",
        declined: "Declined",
        cancelled: "Cancelled",
      }[m.status] || "";
  const faded = m.status === "declined" || m.status === "cancelled" || expired;
  const btn = "h-9 flex-1 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50";
  return (
    <div id={`msg-${m.id}`} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`w-[280px] max-w-full rounded-2xl border p-3.5 ${
        m.status === "accepted" ? "border-emerald-400/30 bg-emerald-500/[0.06]" : "border-[#c9963f]/30 bg-[#c9963f]/[0.07]"
      }`}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#d6bd97]">
          <HiOutlineCalendarDays className="h-4 w-4" /> Meetup
        </p>
        <p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${faded ? "text-white/40 line-through" : "text-white"}`}>
          <HiOutlineMapPin className="h-4 w-4 shrink-0 text-[#d6bd97]" /> {spotLabel(m.spot)}
        </p>
        <p className={`mt-1 pl-6 text-sm ${faded ? "text-white/35 line-through" : "text-white/75"}`}>{meetWhenText(when)}</p>
        <p className={`mt-2 text-xs ${m.status === "accepted" && !expired ? "text-emerald-300" : "text-white/45"}`}>{statusText}</p>
        {m.status === "pending" && !expired && (
          <div className="mt-3 flex gap-2">
            {mine ? (
              <button type="button" disabled={busy} onClick={() => act("cancelled")} className={`${btn} border border-white/10 text-white/70 hover:bg-white/[0.06]`}>
                Cancel proposal
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => act("accepted")} className={`${btn} bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd]`}>
                  Accept
                </button>
                <button type="button" disabled={busy} onClick={() => act("declined")} className={`${btn} border border-white/10 text-white/70 hover:bg-white/[0.06]`}>
                  Decline
                </button>
              </>
            )}
          </div>
        )}
        {!faded && (
          <p className="mt-3 border-t border-white/[0.07] pt-2 text-[11px] leading-relaxed text-white/40">
            Meet in a public campus location during opening hours. Do not share your address.
          </p>
        )}
      </div>
      {receipt && <p className="mt-0.5 px-1 text-[10px] text-white/35">{receipt}</p>}
    </div>
  );
}

// Price offer card. The other person accepts/declines; the sender may cancel.
function OfferCard({ m, mine, nameOf, onAnswer, onProposeMeetup, receipt, currency }) {
  const [busy, setBusy] = useState(false);
  const act = async (status) => {
    setBusy(true);
    await onAnswer(status);
    setBusy(false);
  };
  const amount = formatPrice(m.amount, currency);
  const statusText = {
    pending: mine ? "Waiting for a reply" : `${nameOf(m.senderId)} made an offer`,
    accepted: "Accepted",
    declined: "Declined",
    cancelled: "Cancelled",
  }[m.status] || "";
  const btn = "h-9 flex-1 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50";
  return (
    <div id={`msg-${m.id}`} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`w-[260px] max-w-full rounded-2xl border p-3.5 ${
        m.status === "accepted" ? "border-emerald-400/30 bg-emerald-500/[0.06]" : "border-[#c9963f]/30 bg-[#c9963f]/[0.07]"
      }`}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#d6bd97]">
          <HiOutlineBanknotes className="h-4 w-4" /> Offer
        </p>
        <p className={`mt-1.5 text-xl font-bold ${m.status === "declined" || m.status === "cancelled" ? "text-white/40 line-through" : "text-white"}`}>
          {amount}
        </p>
        <p className={`mt-1 text-xs ${m.status === "accepted" ? "text-emerald-300" : "text-white/45"}`}>{statusText}</p>
        {m.status === "accepted" && (
          <>
            <p className="mt-2 text-xs leading-relaxed text-white/60">Agreed at {amount}. Arrange a meetup to complete the deal.</p>
            {onProposeMeetup && (
              <button type="button" onClick={onProposeMeetup} className="mt-2 text-xs font-semibold text-[#d6bd97] hover:text-[#f4e6cd]">
                Propose a meetup
              </button>
            )}
          </>
        )}
        {m.status === "pending" && (
          <div className="mt-3 flex gap-2">
            {mine ? (
              <button type="button" disabled={busy} onClick={() => act("cancelled")} className={`${btn} border border-white/10 text-white/70 hover:bg-white/[0.06]`}>
                Cancel offer
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => act("accepted")} className={`${btn} bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd]`}>
                  Accept
                </button>
                <button type="button" disabled={busy} onClick={() => act("declined")} className={`${btn} border border-white/10 text-white/70 hover:bg-white/[0.06]`}>
                  Decline
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {receipt && <p className="mt-0.5 px-1 text-[10px] text-white/35">{receipt}</p>}
    </div>
  );
}

function IconBtn({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
    >
      {children}
    </button>
  );
}

// Phone: press and hold a message.
function ActionSheet({ m, uid, now, onClose, onReply, onEdit, onDelete, onReact }) {
  const [confirm, setConfirm] = useState(false);
  const mine = m.senderId === uid;
  const editable = mine && m.type === "text" && !m.deleted && !!m.at && now - m.at.getTime() < 15 * 60 * 1000;
  const row = "flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors";
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Message actions">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[24px] border-t border-white/10 bg-[#15110b] px-4 pt-3"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />
        {m.text && <p className="mb-3 line-clamp-2 px-1 text-sm text-white/50">{m.text}</p>}
        <div className="mb-2 flex justify-between rounded-2xl bg-white/[0.04] p-1.5">
          {REACTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-label={r.label}
              onClick={() => onReact(r.key)}
              className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${m.reactions?.[uid] === r.key ? "bg-[#c9963f]/20" : ""}`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
        <button type="button" className={`${row} text-white/85 hover:bg-white/[0.06]`} onClick={onReply}>
          <HiOutlineArrowUturnLeft className="h-5 w-5 text-[#d6bd97]" /> Reply
        </button>
        {editable && (
          <button type="button" className={`${row} text-white/85 hover:bg-white/[0.06]`} onClick={onEdit}>
            <HiOutlinePencil className="h-5 w-5 text-[#d6bd97]" /> Edit
          </button>
        )}
        {mine && m.type === "text" &&
          (confirm ? (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onDelete} className="h-11 flex-1 rounded-xl bg-red-500/80 text-sm font-semibold text-white">
                Delete for everyone
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="h-11 flex-1 rounded-xl border border-white/10 text-sm font-semibold text-white/70">
                Keep
              </button>
            </div>
          ) : (
            <button type="button" className={`${row} text-red-300 hover:bg-red-500/10`} onClick={() => setConfirm(true)}>
              <HiOutlineTrash className="h-5 w-5" /> Delete
            </button>
          ))}
      </div>
    </div>
  );
}
