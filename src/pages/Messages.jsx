import { Suspense, useEffect, useMemo, useState } from "react";
import { usePageTitle } from "../utils/pageTitle";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineExclamationTriangle,
  HiOutlineMagnifyingGlass,
} from "react-icons/hi2";
import { auth } from "../services/firebase";
import PageLoader from "../components/PageLoader";
import { shortTime, useConversations } from "../utils/conversations";

const inter = { fontFamily: "'Inter', sans-serif" };
const TABS = [
  { key: "all", label: "All" },
  { key: "buying", label: "Buying" },
  { key: "selling", label: "Selling" },
];

// /messages and /messages/:convId. Desktop: inbox on the left, the open chat
// on the right. Phone: the inbox, or the chat full screen.
export default function Messages() {
  const { convId } = useParams();
  usePageTitle(convId ? null : "Messages");
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/login");
      else setUid(user.uid);
    });
    return () => unsub();
  }, [navigate]);

  const { convs, loading, error } = useConversations(uid);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return convs
      .filter((c) => tab === "all" || c.role === tab)
      .filter((c) => !q || c.otherName.toLowerCase().includes(q) || (c.itemTitle || "").toLowerCase().includes(q));
  }, [convs, search, tab]);

  return (
    <div className="flex h-[calc(100dvh-76px-env(safe-area-inset-bottom,0px))] bg-[#0d0b07] text-white md:h-[100dvh]" style={inter}>
      {/* ── Inbox ── */}
      <section
        aria-label="Conversations"
        className={`${convId ? "hidden md:flex" : "flex"} w-full min-w-0 flex-col border-white/[0.07] md:w-[340px] md:shrink-0 md:border-r lg:w-[370px]`}
      >
        <div className="px-4 pb-3 pt-5 sm:px-5">
          <h1 className="text-2xl font-bold text-white" style={inter}>Messages</h1>
          <label className="relative mt-4 block">
            <span className="sr-only">Search conversations</span>
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d6bd97]/50" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people or items"
              className="h-10 w-full rounded-xl border border-[#d6bd97]/15 bg-[#090704]/70 pl-10 pr-3 text-sm text-[#f4e6cd] outline-none transition placeholder:text-white/30 focus:border-[#c9963f]"
            />
          </label>
          <div className="mt-3 flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1" role="group" aria-label="Filter">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t.key ? "bg-[#c9963f]/[0.16] text-[#d6bd97]" : "text-white/45 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ch-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="space-y-1 px-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 py-3">
                  <div className="h-11 w-11 animate-pulse rounded-full bg-white/[0.06]" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.04]" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-4 py-10 text-center">
              <HiOutlineExclamationTriangle className="mx-auto h-6 w-6 text-red-300/70" />
              <p className="mt-2 text-sm text-white/60">Couldn't load your messages.</p>
              <p className="mt-1 text-xs text-white/35">Refresh the page to try again.</p>
            </div>
          ) : convs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                <HiOutlineChatBubbleLeftRight className="h-5 w-5 text-[#d6bd97]" />
              </div>
              <p className="mt-3 text-sm font-semibold text-white/75">No messages yet</p>
              <p className="mt-1 text-sm text-white/40">Tap Message on any listing or service to start a chat.</p>
              <Link to="/marketplace" className="mt-4 inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/75 hover:bg-white/[0.09]">
                Browse Marketplace
              </Link>
            </div>
          ) : shown.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-white/40">No chats match.</p>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((c) => {
                const active = c.id === convId;
                const preview = c.lastMessage
                  ? `${c.lastSenderId === uid ? "You: " : ""}${c.lastMessage}`
                  : "No messages yet";
                return (
                  <li key={c.id}>
                    <Link
                      to={`/messages/${c.id}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                        active ? "bg-[#c9963f]/[0.12]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-[#f4e6cd]"
                        style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
                      >
                        {c.otherPhoto ? <img src={c.otherPhoto} alt="" className="h-full w-full object-cover" /> : c.otherName.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-sm ${c.unread ? "font-bold text-white" : "font-semibold text-white/85"}`}>
                            {c.otherName}
                          </span>
                          <span className={`shrink-0 text-[11px] ${c.unread ? "text-[#d6bd97]" : "text-white/35"}`}>{shortTime(c.updated)}</span>
                        </span>
                        <span className="block truncate text-[11px] text-[#d6bd97]/75">{c.itemTitle}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className={`min-w-0 flex-1 truncate text-[13px] ${c.unread ? "text-white/80" : "text-white/40"}`}>{preview}</span>
                          {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#c9963f]" aria-label="Unread" />}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Open chat (or a hint on desktop) ── */}
      <div className={`${convId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {convId ? (
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        ) : (
          <div className="m-auto max-w-xs px-6 text-center">
            <HiOutlineChatBubbleLeftRight className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-3 text-sm text-white/45">Pick a conversation to read it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
