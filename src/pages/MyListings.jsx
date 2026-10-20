import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlinePause,
  HiOutlinePlay,
  HiOutlinePlusCircle,
  HiOutlineRectangleStack,
  HiOutlineShoppingBag,
  HiOutlineTrash,
  HiOutlineArrowUturnLeft,
  HiOutlineWrenchScrewdriver,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";
import { timeAgo } from "../utils/activity";
import { setPostStatus } from "../utils/postStatus";
import { serviceCategoryEmoji } from "../constants/serviceCategories";

const inter = { fontFamily: "'Inter', sans-serif" };
const formatKs = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);

const card =
  "relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "off", label: "Sold / Paused" },
  { key: "removed", label: "Removed" },
];
const TYPE_FILTERS = [
  { key: "all", label: "Everything" },
  { key: "listing", label: "Items" },
  { key: "service", label: "Services" },
];

const STATUS_STYLE = {
  active: { label: "Active", cls: "text-emerald-300", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  sold: { label: "Sold", cls: "text-[#d6bd97]", bg: "rgba(201,150,63,0.12)", border: "rgba(201,150,63,0.35)" },
  paused: { label: "Paused", cls: "text-[#d6bd97]", bg: "rgba(201,150,63,0.12)", border: "rgba(201,150,63,0.35)" },
  removed: { label: "Removed", cls: "text-white/50", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)" },
};

// My listings: every listing and service I posted, in one list, with the
// same status controls as the detail pages. Removed posts have no Restore
// here on purpose (an admin may have removed them).
export default function MyListings() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [show, setShow] = useState(false);
  const [uid, setUid] = useState(null);
  const [posts, setPosts] = useState([]); // { id, type, title, price, status, photo, category, createdAt, questions }
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);

  const statusFilter = STATUS_FILTERS.some((f) => f.key === params.get("status")) ? params.get("status") : "all";
  const typeFilter = TYPE_FILTERS.some((f) => f.key === params.get("type")) ? params.get("type") : "all";
  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const [popup, setPopup] = useState({ show: false, text: "", ok: true });
  const toast = (text, ok = true) => {
    setPopup({ show: true, text, ok });
    setTimeout(() => setPopup((p) => ({ ...p, show: false })), 2200);
  };

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 100);
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      setUid(user.uid);
      try {
        const [lSnap, sSnap] = await Promise.all([
          getDocs(query(collection(db, "listings"), where("sellerId", "==", user.uid))),
          getDocs(query(collection(db, "services"), where("providerId", "==", user.uid))),
        ]);
        const toPost = (type) => (d) => {
          const x = d.data();
          return {
            id: d.id,
            type,
            title: x.title || "Untitled",
            price: x.price,
            status: x.status || "active",
            photo: (x.photos && x.photos[0]) || "",
            category: x.category,
            createdAt: x.createdAt?.toDate?.() ?? null,
            questions: null,
          };
        };
        const list = [...lSnap.docs.map(toPost("listing")), ...sSnap.docs.map(toPost("service"))].sort(
          (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
        );
        setPosts(list);
        setLoading(false);

        // Question counts, filled in after the list shows.
        const counts = await Promise.all(
          list.map(async (p) => {
            try {
              const c = await getCountFromServer(
                collection(db, `${p.type === "listing" ? "listings" : "services"}/${p.id}/comments`)
              );
              return c.data().count;
            } catch {
              return null;
            }
          })
        );
        setPosts((prev) =>
          prev.map((p) => {
            const i = list.findIndex((q) => q.id === p.id && q.type === p.type);
            return i >= 0 ? { ...p, questions: counts[i] } : p;
          })
        );
      } catch (err) {
        console.error("My listings load failed:", err);
        setLoadErr(true);
        setLoading(false);
      }
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [navigate]);

  const counts = useMemo(() => {
    const byType = posts.filter((p) => typeFilter === "all" || p.type === typeFilter);
    return {
      all: byType.length,
      active: byType.filter((p) => p.status === "active").length,
      off: byType.filter((p) => p.status === "sold" || p.status === "paused").length,
      removed: byType.filter((p) => p.status === "removed").length,
    };
  }, [posts, typeFilter]);

  const visible = posts.filter(
    (p) =>
      (typeFilter === "all" || p.type === typeFilter) &&
      (statusFilter === "all" ||
        (statusFilter === "active" && p.status === "active") ||
        (statusFilter === "off" && (p.status === "sold" || p.status === "paused")) ||
        (statusFilter === "removed" && p.status === "removed"))
  );

  const change = async (post, next) => {
    const key = `${post.type}-${post.id}`;
    if (!uid || busyKey) return;
    setBusyKey(key);
    try {
      await setPostStatus({ type: post.type, id: post.id, uid, next });
      setPosts((prev) => prev.map((p) => (p.id === post.id && p.type === post.type ? { ...p, status: next } : p)));
      setConfirmKey(null);
      const noun = post.type === "listing" ? "Listing" : "Service";
      toast(
        next === "removed"
          ? `${noun} removed.`
          : next === "sold"
          ? "Marked as sold."
          : next === "paused"
          ? "Service paused."
          : `${noun} is live again.`
      );
    } catch (err) {
      console.error("Status change failed:", err);
      toast("Couldn't update it. Try again.", false);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0b07] text-white" style={inter}>
      <div className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${dashboardBg})` }} aria-hidden />
      <div className="absolute inset-0 bg-[#0d0b07]/85" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a120a]/45 via-[#0d0b07]/75 to-black/95" aria-hidden />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* ── Header ── */}
        <header
          className={`${card} mb-5 px-6 py-5 transition-all duration-700 ${
            show ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          }`}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg,transparent,rgba(214,189,151,0.5),transparent)" }}
          />
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.38em] text-white/35">Your posts</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl" style={inter}>My listings</h1>
              <p className="mt-1 text-sm text-[#f4e6cd]/55">Everything you posted. Mark items sold, pause services, or remove them.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/marketplace/new"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-4 text-sm font-bold text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all hover:-translate-y-0.5"
              >
                <HiOutlinePlusCircle className="h-4 w-4" /> Sell an item
              </Link>
              <Link
                to="/services/new"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/80 transition-all hover:bg-white/[0.09] hover:text-white"
              >
                <HiOutlineWrenchScrewdriver className="h-4 w-4" /> Offer a service
              </Link>
            </div>
          </div>
        </header>

        {/* ── Filters ── */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Status">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter("status", f.key)}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60 ${
                    active
                      ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd]"
                      : "border border-white/10 bg-white/[0.04] text-[#f4e6cd]/70 hover:border-[#c9963f]/40 hover:text-[#f4e6cd]"
                  }`}
                >
                  {f.label}
                  {!loading && <span className={active ? "text-[#f4e6cd]/80" : "text-white/35"}>{counts[f.key]}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1" role="group" aria-label="Type">
            {TYPE_FILTERS.map((f) => {
              const active = typeFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter("type", f.key)}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    active ? "bg-[#c9963f]/[0.16] text-[#d6bd97]" : "text-white/45 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
            ))}
          </div>
        ) : loadErr ? (
          <div className={`${card} flex flex-col items-center px-4 py-14 text-center`}>
            <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
            <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load your posts</p>
            <p className="mt-1 max-w-[260px] text-sm text-white/40">Check your connection and refresh the page.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className={`${card} flex flex-col items-center px-4 py-16 text-center`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
              <HiOutlineRectangleStack className="h-6 w-6 text-[#d6bd97]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white" style={inter}>You haven't posted anything yet</h3>
            <p className="mt-1 max-w-[300px] text-sm text-[#f4e6cd]/45">Sell something you don't need, or offer a skill to other students.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className={`${card} flex flex-col items-center px-4 py-12 text-center`}>
            <p className="text-sm font-semibold text-white/70">Nothing here</p>
            <p className="mt-1 text-sm text-white/40">No posts match these filters.</p>
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="mt-4 h-9 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/75 hover:bg-white/[0.09]"
            >
              Show everything
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((post, i) => {
              const key = `${post.type}-${post.id}`;
              return (
                <PostRow
                  key={key}
                  post={post}
                  index={i}
                  show={show}
                  busy={busyKey === key}
                  confirming={confirmKey === key}
                  onAsk={() => setConfirmKey(key)}
                  onCancel={() => setConfirmKey(null)}
                  onChange={(next) => change(post, next)}
                />
              );
            })}
          </ul>
        )}
      </div>

      {popup.show && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-[calc(16px+env(safe-area-inset-top,0px))] z-[70] w-72 max-w-[78vw] rounded-xl p-4 text-sm font-semibold text-white shadow-lg ${
            popup.ok ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f]" : "bg-gradient-to-r from-red-500 to-rose-500"
          }`}
        >
          {popup.text}
        </div>
      )}
    </div>
  );
}

function PostRow({ post, index, show, busy, confirming, onAsk, onCancel, onChange }) {
  const isListing = post.type === "listing";
  const st = STATUS_STYLE[post.status] || STATUS_STYLE.active;
  const to = `/${isListing ? "marketplace" : "services"}/${post.id}`;
  const removed = post.status === "removed";
  const delay = Math.min(index, 8) * 40;

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors disabled:opacity-50";
  const neutral = `${btn} border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09] hover:text-white`;

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:gap-4 ${
        removed ? "opacity-60" : ""
      }`}
      style={{
        opacity: show ? undefined : 0,
        transform: show ? "translateY(0)" : "translateY(10px)",
        transition: `opacity .4s ease ${delay}ms, transform .4s ease ${delay}ms`,
      }}
    >
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#090704]">
          {post.photo ? (
            <img src={post.photo} alt="" loading="lazy" className={`h-full w-full object-cover ${post.status === "active" ? "" : "grayscale"}`} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/20">
              {isListing ? (
                <HiOutlineShoppingBag className="h-7 w-7" />
              ) : (
                <span className="text-3xl opacity-70" aria-hidden="true">{serviceCategoryEmoji(post.category)}</span>
              )}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.cls}`}
              style={{ background: st.bg, border: `1px solid ${st.border}` }}
            >
              {st.label}
            </span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              {isListing ? "Item" : "Service"}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-[15px] font-semibold text-white" style={inter}>{post.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/40">
            <span className="font-semibold text-[#d6bd97]">Ks {formatKs(post.price)}</span>
            <span>Posted {timeAgo(post.createdAt)}</span>
            {post.questions != null && (
              <span className="inline-flex items-center gap-1">
                <HiOutlineChatBubbleLeftRight className="h-3 w-3" />
                {post.questions} {post.questions === 1 ? "question" : "questions"}
              </span>
            )}
          </p>
        </div>
      </Link>

      {/* Actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {removed ? (
          <span className="text-xs text-white/35">Removed. It's hidden from everyone.</span>
        ) : confirming ? (
          <>
            <span className="text-xs text-white/60">Remove for everyone?</span>
            <button
              type="button"
              onClick={() => onChange("removed")}
              disabled={busy}
              className={`${btn} border-red-400/30 bg-red-500/15 text-red-300 hover:bg-red-500/25`}
            >
              {busy ? "Removing…" : "Remove"}
            </button>
            <button type="button" onClick={onCancel} disabled={busy} className={neutral}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {isListing && post.status === "active" && (
              <button type="button" onClick={() => onChange("sold")} disabled={busy} className={neutral}>
                <HiOutlineCheckCircle className="h-4 w-4" /> Mark sold
              </button>
            )}
            {isListing && post.status === "sold" && (
              <button type="button" onClick={() => onChange("active")} disabled={busy} className={neutral}>
                <HiOutlineArrowUturnLeft className="h-4 w-4" /> Available again
              </button>
            )}
            {!isListing && post.status === "active" && (
              <button type="button" onClick={() => onChange("paused")} disabled={busy} className={neutral}>
                <HiOutlinePause className="h-4 w-4" /> Pause
              </button>
            )}
            {!isListing && post.status === "paused" && (
              <button type="button" onClick={() => onChange("active")} disabled={busy} className={neutral}>
                <HiOutlinePlay className="h-4 w-4" /> Resume
              </button>
            )}
            <button
              type="button"
              onClick={onAsk}
              disabled={busy}
              aria-label={`Remove ${post.title}`}
              className={`${btn} border-white/10 bg-white/[0.04] text-white/50 hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300`}
            >
              <HiOutlineTrash className="h-4 w-4" /> Remove
            </button>
          </>
        )}
      </div>
    </li>
  );
}
