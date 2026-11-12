import { useEffect, useState } from "react";
import { usePageTitle } from "../utils/pageTitle";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import {
  HiOutlineShoppingBag,
  HiOutlineWrenchScrewdriver,
  HiOutlinePlusCircle,
  HiOutlineArrowRight,
  HiOutlineBookmark,
  HiOutlineSparkles,
  HiOutlineBellAlert,
  HiOutlineCheckBadge,
  HiOutlineShieldCheck,
  HiOutlineCheck,
  HiOutlineChatBubbleLeftRight,
  HiOutlineExclamationTriangle,
  HiOutlineFlag,
  HiOutlineInboxStack,
  HiOutlineCheckCircle,
  HiOutlineQuestionMarkCircle,
  HiOutlineMagnifyingGlass,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import mascotGif from "../assets/TS.webp";
import dashboardBg from "../assets/dashboard-bg.jpg";
import { ACTIVITY_LIMIT, markActivityRead, timeAgo, useActivity } from "../utils/activity";
import { useInbox } from "../utils/inbox";
import { shortTime } from "../utils/conversations";
import { formatPostPrice } from "../utils/postDetails";
import { serviceCategoryEmoji } from "../constants/serviceCategories";
import AnnouncementBanner from "../components/AnnouncementBanner";
import { removalReasonText } from "../utils/notifications";

/* ─── Animated counter hook ────────────────────────────────────── */
function useCountUp(target, duration = 1100, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, active]);
  return count;
}

/* ─── Individual stat card ──────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, to, loading, show, delay = 0 }) {
  const num = parseInt(value, 10) || 0;
  const count = useCountUp(num, 1000, show && !loading);
  return (
    <Link
      to={to}
      aria-label={`${label}: ${loading ? "loading" : num}`}
      className="block rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 text-center transition-all duration-500 hover:-translate-y-1.5 hover:border-[#c9963f]/40 hover:bg-white/[0.08] hover:shadow-[0_14px_28px_rgba(0,0,0,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms, background 0.3s, border-color 0.3s, box-shadow 0.3s`,
      }}
    >
      <div className="mb-2.5 flex justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
          <Icon className="h-4 w-4 text-white/60" />
        </div>
      </div>
      <p className="font-mono text-[28px] font-bold tabular-nums text-white leading-none">
        {loading ? <span className="text-white/25">--</span> : String(count).padStart(2, "0")}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
    </Link>
  );
}

/* ─── Time-based greeting ───────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ─── Main Dashboard ────────────────────────────────────────────── */
export default function Dashboard() {
  usePageTitle("Dashboard");
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  // Comments newer than this are "unread". null = never marked, so all unread.
  const [seenAt, setSeenAt] = useState(null);
  const [marking, setMarking] = useState(false);
  // Real counts from the actual documents (not the stored counters, which drift).
  const [counts, setCounts] = useState(null); // { listings, services, saved } | null while loading
  // My listings + services (newest first) for the My posts card and selling stats.
  const [myPosts, setMyPosts] = useState(null); // [] | null while loading | "error"

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 120);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { navigate("/login"); return; }
      setUser(currentUser);
      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        const data = snap.exists() ? snap.data() : null;
        setProfile(data);
        setSeenAt(data?.activitySeenAt?.toDate?.() ?? null);
      } catch (err) {
        console.error("Error loading profile:", err);
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [navigate]);

  // Count my listings (active + sold), services (active + paused) and saves.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const uid = user.uid;
    Promise.all([
      getDocs(query(collection(db, "listings"), where("sellerId", "==", uid))),
      getDocs(query(collection(db, "services"), where("providerId", "==", uid))),
      getDocs(query(collection(db, "saves"), where("uid", "==", uid))),
    ])
      .then(([l, sv, sa]) => {
        if (!alive) return;
        const notRemoved = (snap) => snap.docs.filter((d) => d.data().status !== "removed").length;
        setCounts({ listings: notRemoved(l), services: notRemoved(sv), saved: sa.size });
        const posts = [
          ...l.docs.map((d) => ({ id: d.id, kind: "listing", ...d.data() })),
          ...sv.docs.map((d) => ({ id: d.id, kind: "service", ...d.data() })),
        ].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setMyPosts(posts);
      })
      .catch((err) => {
        console.error("Couldn't count your posts:", err);
        // Fall back to the stored counters so the card still shows something.
        if (alive) {
          setCounts({ fallback: true });
          setMyPosts("error");
        }
      });
    return () => { alive = false; };
  }, [user]);

  const username = profile?.username?.trim() || user?.email?.split("@")[0] || "Student";
  const isApproved = profile?.approved === true;
  const isAdmin = profile?.role === "admin";
  const profileCompleted = profile?.profileCompleted === true;

  /* ── Real profile completion (6 fields) ── */
  const completionFields = [
    profile?.fullName,
    profile?.bio,
    profile?.department,
    profile?.graduationYear,
    profile?.university,
    profile?.profilePhoto,
  ];
  const filledCount = completionFields.filter(
    (v) => v != null && String(v).trim() !== ""
  ).length;
  const completionPct = Math.round((filledCount / completionFields.length) * 100);

  // Live inbox shared by the app shell (no extra Firestore listener).
  const inbox = useInbox();

  // Slim action row under the greeting (replaces the Quick Actions cards).
  const actions = [
    { label: "Sell an item", short: "Sell", to: "/marketplace/new", icon: HiOutlinePlusCircle, primary: true },
    { label: "Offer a service", short: "Offer service", to: "/services/new", icon: HiOutlineWrenchScrewdriver },
    { label: "Browse", short: "Browse", to: "/marketplace", icon: HiOutlineMagnifyingGlass },
    { label: "Messages", short: "Chats", to: "/messages", icon: HiOutlineChatBubbleLeftRight, badge: inbox.unreadCount },
  ];

  // Questions other students asked on my listings and services (live).
  const { items: activity, loading: activityLoading, error: activityError } = useActivity(user?.uid);
  const isUnread = (a) => !seenAt || (a.createdAt && a.createdAt > seenAt);
  const unreadCount = activity.filter(isUnread).length;

  // Selling stats, all from data already loaded on this page.
  const postsReady = Array.isArray(myPosts);
  const questions = activity.filter((a) => a.kind === "question").length;
  const sellingStats = [
    {
      label: "Active posts",
      value: postsReady ? myPosts.filter((p) => p.status === "active").length : null,
      icon: HiOutlineInboxStack,
      to: "/my-listings",
    },
    {
      label: "Sold",
      value: postsReady ? myPosts.filter((p) => p.kind === "listing" && p.status === "sold").length : null,
      icon: HiOutlineCheckCircle,
      to: "/my-listings?type=listing",
    },
    {
      label: "Buyer chats",
      value: inbox.loading ? null : inbox.convs.filter((c) => c.role === "selling").length,
      icon: HiOutlineChatBubbleLeftRight,
      to: "/messages",
    },
    {
      label: "Questions received",
      value: activityLoading ? null : questions >= ACTIVITY_LIMIT ? `${ACTIVITY_LIMIT}+` : questions,
      icon: HiOutlineQuestionMarkCircle,
      to: "#activity",
    },
  ];

  const handleMarkRead = async () => {
    if (!user || marking) return;
    setMarking(true);
    try {
      await markActivityRead(user.uid);
      setSeenAt(new Date());
    } catch (err) {
      console.error("Couldn't mark activity as read:", err);
    } finally {
      setMarking(false);
    }
  };

  const useStored = counts?.fallback === true;
  const stats = [
    { label: "Listings", value: useStored ? profile?.listingsCount ?? 0 : counts?.listings ?? 0, icon: HiOutlineShoppingBag, to: "/my-listings?type=listing" },
    { label: "Services", value: useStored ? profile?.servicesCount ?? 0 : counts?.services ?? 0, icon: HiOutlineWrenchScrewdriver, to: "/my-listings?type=service" },
    { label: "Saved", value: useStored ? profile?.savedCount ?? 0 : counts?.saved ?? 0, icon: HiOutlineBookmark, to: "/saved" },
  ];

  /* ── shared card class ── */
  const card =
    "relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

  /* ── top accent line helper ── */
  const TopLine = ({ from, via, to: t }) => (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-px"
      style={{
        background: `linear-gradient(90deg, ${from ?? "transparent"}, ${via}, ${t ?? "transparent"})`,
      }}
    />
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0b07] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── BG image ── */}
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${dashboardBg})` }}
      />
      <div className="absolute inset-0 bg-[#0d0b07]/80" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a120a]/45 via-[#0d0b07]/70 to-black/95" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Campus announcement (stage 18c-3) ── */}
        <div className="mb-4 empty:hidden">
          <AnnouncementBanner />
        </div>

        {/* ── Profile incomplete banner ── */}
        {!loadingProfile && !profileCompleted && !isAdmin && (
          <div
            className="mb-4 flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5 transition-all duration-700"
            style={{
              border: "1px solid rgba(201,150,63,0.28)",
              background: "rgba(201,150,63,0.07)",
              opacity: show ? 1 : 0,
              transform: show ? "translateY(0)" : "translateY(-8px)",
              transition: "opacity 0.6s ease, transform 0.6s ease",
            }}
          >
            <div className="flex items-center gap-3">
              <HiOutlineSparkles className="h-4 w-4 shrink-0 text-[#c9963f]" />
              <p className="text-sm text-[#d6bd97]">
                Your profile is incomplete — finish it to build trust with buyers and sellers.
              </p>
            </div>
            <Link
              to="/Profile"
              className="shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#d6bd97] transition-all hover:bg-[#c9963f]/15"
              style={{ border: "1px solid rgba(201,150,63,0.35)" }}
            >
              Finish
            </Link>
          </div>
        )}

        {/* ── Header ── */}
        <header
          className={`${card} mb-6 px-6 py-5 transition-all duration-700 ${
            show ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          }`}
        >
          <TopLine via="rgba(214,189,151,0.50)" />

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] uppercase tracking-[0.38em] text-white/35">CampusHub</p>
                {isAdmin && (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#d6bd97]"
                    style={{ border: "1px solid rgba(201,150,63,0.35)", background: "rgba(201,150,63,0.12)" }}
                  >
                    <HiOutlineShieldCheck className="h-3 w-3" /> Admin
                  </span>
                )}
                {isApproved && !isAdmin && (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
                    style={{ border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.10)" }}
                  >
                    <HiOutlineCheckBadge className="h-3 w-3" /> Approved
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Dashboard
                </h1>
                {unreadCount > 0 && (
                  <a
                    href="#activity"
                    className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-[#f4e6cd] transition-all hover:-translate-y-0.5"
                    style={{ border: "1px solid rgba(201,150,63,0.45)", background: "rgba(201,150,63,0.18)" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c9963f] shadow-[0_0_6px_#c9963f]" />
                    {unreadCount} new
                  </a>
                )}
              </div>
            </div>

          </div>
        </header>

        {/* ── Hero row ── */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_0.9fr]">

          {/* Welcome card (compact, stage 18b) */}
          <div
            className={`${card} flex flex-col justify-between gap-6 px-6 py-6 transition-all duration-700 sm:px-8 sm:py-7 ${
              show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
          >
            <TopLine via="rgba(143,119,75,0.45)" t="rgba(201,150,63,0.35)" />
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#c9963f]/[0.10] blur-3xl" />
            <div className="relative z-10 flex items-center gap-5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.42em] text-white/35">{getGreeting()}</p>
                <h2 className="mt-2 truncate text-3xl font-bold leading-tight text-white sm:text-4xl" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {loadingProfile ? <span className="inline-block h-9 w-44 animate-pulse rounded-xl bg-white/10" /> : username}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
                  Here's what's happening with your posts and chats.
                </p>
              </div>
              <img
                src={mascotGif}
                alt=""
                aria-hidden="true"
                className="animate-mascot-bob hidden w-[96px] shrink-0 opacity-90 drop-shadow-[0_16px_30px_rgba(0,0,0,0.5)] sm:block lg:w-[150px]"
                style={{ imageRendering: "pixelated" }}
              />
            </div>

            {/* At a glance: fills the card when it stretches to the profile card's height */}
            <div className="relative z-10 flex flex-wrap gap-2">
              {[
                {
                  to: "/messages",
                  icon: HiOutlineChatBubbleLeftRight,
                  text: inbox.unreadCount ? `${inbox.unreadCount} unread chat${inbox.unreadCount === 1 ? "" : "s"}` : "No unread chats",
                  hot: inbox.unreadCount > 0,
                },
                {
                  to: "#activity",
                  icon: HiOutlineQuestionMarkCircle,
                  text: unreadCount ? `${unreadCount} new in Activity` : "Activity all read",
                  hot: unreadCount > 0,
                },
                ...(isAdmin
                  ? []
                  : [
                      {
                        to: "/Profile",
                        icon: HiOutlineCheckCircle,
                        text: completionPct >= 100 ? "Profile complete" : `Profile ${completionPct}% complete`,
                        hot: completionPct < 100,
                      },
                    ]),
              ].map(({ to, icon: Icon, text, hot }) => {
                const cls = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  hot
                    ? "border-[#c9963f]/35 bg-[#c9963f]/10 text-[#e8c88f] hover:bg-[#c9963f]/15"
                    : "border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-white/15 hover:text-white/70"
                }`;
                const inner = (
                  <>
                    <Icon className="h-3.5 w-3.5" /> {text}
                  </>
                );
                return to.startsWith("#") ? (
                  <a key={text} href={to} className={cls}>{inner}</a>
                ) : (
                  <Link key={text} to={to} className={cls}>{inner}</Link>
                );
              })}
            </div>

            {/* Action row */}
            <div className="relative z-10 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
              {actions.map(({ label, short, to, icon: Icon, primary, badge }) => (
                <Link
                  key={label}
                  to={to}
                  aria-label={badge > 0 ? `${label}, ${badge} unread` : label}
                  className={`relative inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:px-5 ${
                    primary
                      ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd] hover:shadow-[0_12px_28px_rgba(143,119,75,0.45)]"
                      : "border border-white/[0.09] bg-white/[0.05] text-white/80 hover:border-[#c9963f]/40 hover:bg-[#c9963f]/10 hover:text-[#f4e6cd]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate sm:hidden">{short}</span>
                  <span className="hidden truncate sm:inline">{label}</span>
                  {badge > 0 && (
                    <span
                      className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c9963f] px-1 text-[10px] font-bold text-[#1a120a]"
                      aria-label={`${badge} unread`}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Profile card */}
          <aside
            className={`${card} p-7 transition-all duration-700 delay-100 ${
              show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
          >
            <TopLine via="rgba(201,150,63,0.45)" />

            <div className="relative z-10 flex h-full flex-col">
              {/* Avatar + info */}
              <div className="flex items-start gap-4">
                <div
                  className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-[#f4e6cd] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                  style={{
                    background: "linear-gradient(135deg, rgba(143,119,75,0.35), rgba(201,150,63,0.25))",
                    border: "1px solid rgba(201,150,63,0.30)",
                  }}
                >
                  {/^https?:\/\//i.test(profile?.profilePhoto || "") ? (
                    <img
                      src={profile.profilePhoto}
                      alt="Your profile"
                      className="absolute inset-0 h-full w-full rounded-2xl object-cover"
                    />
                  ) : (
                    username?.slice(0, 1)?.toUpperCase() || "U"
                  )}
                  {/* online dot */}
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0d0b07] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {loadingProfile ? (
                      <span className="inline-block h-5 w-32 animate-pulse rounded-lg bg-white/10" />
                    ) : (
                      username
                    )}
                  </h3>
                  <p className="mt-1 break-all text-sm text-white/40">{user?.email}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex h-6 items-center rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                      {isAdmin ? "Admin" : "Student"}
                    </span>
                    {isApproved && (
                      <span
                        className="inline-flex h-6 items-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400"
                        style={{ border: "1px solid rgba(16,185,129,0.28)", background: "rgba(16,185,129,0.10)" }}
                      >
                        <HiOutlineCheckBadge className="h-3 w-3" /> Approved
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-3 gap-2">
                {stats.map((item, i) => (
                  <StatCard key={item.label} {...item} loading={counts === null} show={show} delay={300 + i * 80} />
                ))}
              </div>

              {/* Profile completion */}
              {!profileCompleted && (
                <div
                  className="mt-5 rounded-2xl p-4"
                  style={{ border: "1px solid rgba(201,150,63,0.20)", background: "rgba(201,150,63,0.05)" }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#c9963f]/70">
                      Profile
                    </p>
                    <p className="text-xs text-[#c9963f]/60">{completionPct}%</p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full transition-all duration-[1200ms] ease-out"
                      style={{
                        width: show ? `${completionPct}%` : "0%",
                        background: "linear-gradient(90deg, #8f774b, #c9963f)",
                        transitionDelay: "400ms",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-white/35">
                    Finish your profile to unlock full access.
                  </p>
                </div>
              )}

              <div className="mt-auto pt-5">
                <Link
                  to="/Profile"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] text-sm font-semibold uppercase tracking-[0.14em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09]"
                >
                  View Profile
                </Link>
              </div>
            </div>
          </aside>
        </section>

        {/* ── Selling stats (stage 18b) ── */}
        <section
          aria-label="Selling stats"
          className={`mt-6 grid grid-cols-2 gap-3 transition-all duration-700 delay-100 lg:grid-cols-4 ${
            show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}
        >
          {sellingStats.map(({ label, value, icon: Icon, to }) => {
            const inner = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c9963f]/25 bg-[#c9963f]/10">
                  <Icon className="h-5 w-5 text-[#d6bd97]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-2xl font-bold leading-none tabular-nums text-white">
                    {value === null ? <span className="text-white/25">–</span> : value}
                  </span>
                  <span className="mt-1 block text-[10px] uppercase leading-tight tracking-[0.12em] text-white/40 sm:text-[11px] sm:tracking-[0.14em]">{label}</span>
                </span>
              </>
            );
            const cls =
              "flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3.5 sm:px-4 sm:py-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[#c9963f]/35 hover:bg-white/[0.06] motion-reduce:hover:translate-y-0";
            return to.startsWith("#") ? (
              <a key={label} href={to} className={cls}>{inner}</a>
            ) : (
              <Link key={label} to={to} className={cls}>{inner}</Link>
            );
          })}
        </section>

        {/* ── My posts + Messages (stage 18b) ── */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div
            className={`${card} p-6 transition-all duration-700 delay-150 sm:p-7 ${
              show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
          >
            <TopLine via="rgba(201,150,63,0.45)" />
            <CardHead eyebrow="Selling" title="My posts" linkTo="/my-listings" linkLabel="Manage" />
            {myPosts === null ? (
              <RowSkeleton />
            ) : myPosts === "error" ? (
              <CardMessage icon={HiOutlineExclamationTriangle} text="Couldn't load your posts." sub="Refresh the page to try again." />
            ) : myPosts.length === 0 ? (
              <CardMessage
                icon={HiOutlineShoppingBag}
                text="No posts yet"
                sub="Sell something you no longer need, or offer a skill."
                action={{ to: "/marketplace/new", label: "Sell your first item" }}
              />
            ) : (
              <ul className="relative z-10 space-y-2">
                {myPosts.slice(0, 3).map((p) => (
                  <li key={`${p.kind}-${p.id}`}>
                    <Link
                      to={`/${p.kind === "listing" ? "marketplace" : "services"}/${p.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5 pr-3 transition-all hover:border-white/[0.12] hover:bg-white/[0.06]"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#090704] text-xl">
                        {p.photos?.[0] ? (
                          <img src={p.photos[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : p.kind === "service" ? (
                          <span aria-hidden="true">{serviceCategoryEmoji(p.category)}</span>
                        ) : (
                          <HiOutlineShoppingBag className="h-5 w-5 text-white/20" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">{p.title}</span>
                        <span className="mt-0.5 block text-xs text-[#d6bd97]">
                          {formatPostPrice(p)}
                          <span className="text-white/35"> · {p.kind === "listing" ? "Listing" : "Service"}</span>
                        </span>
                      </span>
                      <StatusChip post={p} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className={`${card} p-6 transition-all duration-700 delay-200 sm:p-7 ${
              show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
          >
            <TopLine via="rgba(214,189,151,0.45)" />
            <CardHead
              eyebrow={inbox.unreadCount > 0 ? `${inbox.unreadCount} unread` : "Chats"}
              title="Messages"
              linkTo="/messages"
              linkLabel="Open"
            />
            {inbox.loading ? (
              <RowSkeleton round />
            ) : inbox.error ? (
              <CardMessage icon={HiOutlineExclamationTriangle} text="Couldn't load your messages." sub="Refresh the page to try again." />
            ) : inbox.convs.length === 0 ? (
              <CardMessage
                icon={HiOutlineChatBubbleLeftRight}
                text="No messages yet"
                sub="Tap Message on any listing or service to start a chat."
                action={{ to: "/marketplace", label: "Browse Marketplace" }}
              />
            ) : (
              <ul className="relative z-10 space-y-2">
                {inbox.convs.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/messages/${c.id}`}
                      className={`flex items-center gap-3 rounded-2xl border p-2.5 pr-3 transition-all hover:bg-white/[0.06] ${
                        c.unread ? "border-[#c9963f]/25 bg-[#c9963f]/[0.06]" : "border-white/[0.06] bg-white/[0.03]"
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
                          <span className={`truncate text-sm ${c.unread ? "font-bold text-white" : "font-semibold text-white/85"}`}>{c.otherName}</span>
                          <span className="shrink-0 text-[11px] text-white/35">{shortTime(c.updated)}</span>
                        </span>
                        <span className="block truncate text-[11px] text-[#d6bd97]/75">{c.itemTitle}</span>
                        <span className={`block truncate text-[13px] ${c.unread ? "text-white/80" : "text-white/40"}`}>
                          {c.lastMessage ? `${c.lastSenderId === user?.uid ? "You: " : ""}${c.lastMessage}` : "No messages yet"}
                        </span>
                      </span>
                      {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#c9963f]" aria-label="Unread" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Activity ── */}
        <section className="mt-6">
          {/* Activity feed */}
          <div
            id="activity"
            className={`${card} scroll-mt-6 p-7 transition-all duration-700 delay-200 ${
              show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
          >
            <TopLine via="rgba(214,189,151,0.45)" />

            <div className="relative z-10">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.38em] text-white/35">
                    Notifications
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Activity</h3>
                </div>
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05]">
                  <HiOutlineBellAlert className={`h-4 w-4 ${unreadCount > 0 ? "text-[#d6bd97]" : "text-white/50"}`} />
                  {unreadCount > 0 && (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c9963f] px-1 text-[10px] font-bold text-[#1a120a] shadow-[0_0_10px_rgba(201,150,63,0.6)]"
                      aria-label={`${unreadCount} unread`}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
              </div>

              {unreadCount > 0 && (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleMarkRead}
                    disabled={marking}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#d6bd97] transition-all hover:bg-[#c9963f]/15 disabled:opacity-50"
                    style={{ border: "1px solid rgba(201,150,63,0.30)" }}
                  >
                    <HiOutlineCheck className="h-3.5 w-3.5" />
                    {marking ? "Marking…" : "Mark all as read"}
                  </button>
                </div>
              )}

              {activityLoading ? (
                <div className="space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-3 rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-4">
                      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.08]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.08]" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activityError ? (
                <div className="flex flex-col items-center rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center">
                  <HiOutlineExclamationTriangle className="h-5 w-5 text-red-300/70" />
                  <p className="mt-2 text-sm text-white/60">Couldn't load your activity.</p>
                  <p className="mt-1 text-xs text-white/35">Refresh the page to try again.</p>
                </div>
              ) : activity.length > 0 ? (
                <ul className="ch-scroll ch-fade-bottom -mr-3 max-h-[420px] space-y-2.5 overflow-y-auto py-1 pb-6 pr-3">
                  {activity.map((item, i) => {
                    const unread = isUnread(item);
                    const rowCls = `flex items-start gap-3 rounded-[18px] border px-4 py-3.5 transition-all duration-300 ${
                      unread ? "border-[#c9963f]/25 bg-[#c9963f]/[0.06]" : "border-white/[0.06] bg-white/[0.03]"
                    } ${item.to ? "hover:bg-white/[0.07] hover:border-white/[0.12]" : ""}`;
                    const body = (
                      <>
                        <ActivityIcon item={item} />
                        <div className="min-w-0 flex-1">
                          <ActivityText item={item} />
                        </div>
                        {unread && (
                          <span
                            className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#c9963f] shadow-[0_0_6px_#c9963f]"
                            aria-label="Unread"
                          />
                        )}
                      </>
                    );
                    return (
                      <li
                        key={`${item.kind}-${item.id}`}
                        style={{
                          opacity: show ? 1 : 0,
                          transform: show ? "translateX(0)" : "translateX(-10px)",
                          transition: `opacity 0.5s ease ${350 + Math.min(i, 6) * 70}ms, transform 0.5s ease ${350 + Math.min(i, 6) * 70}ms`,
                        }}
                      >
                        {item.to ? (
                          <Link to={item.to} className={rowCls}>{body}</Link>
                        ) : (
                          <div className={rowCls}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div
                  className="flex flex-col items-center justify-center rounded-[18px] border border-dashed px-4 py-10 text-center"
                  style={{ borderColor: "rgba(255,255,255,0.07)" }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05]">
                    <HiOutlineBellAlert className="h-5 w-5 text-white/40" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white/70">
                    No activity yet
                  </p>
                  <p className="mt-1 max-w-[240px] text-sm leading-6 text-white/35">
                    Questions on your posts and updates from moderators will show up here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer
          className={`mt-6 flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6 py-3.5 transition-all duration-700 delay-[280ms] ${
            show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/20">
            CampusHub © {new Date().getFullYear()}
          </p>
          <p className="text-[11px] text-white/15">Student Marketplace</p>
        </footer>
      </div>
    </div>
  );
}

/* ─── Activity row pieces ───────────────────────────────────────── */
// Questions show the asker's avatar; system notifications show an icon.
function ActivityIcon({ item }) {
  if (item.kind === "question") {
    return (
      <div className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-xs font-bold text-[#f4e6cd]">
        {item.authorPhoto ? (
          <img src={item.authorPhoto} alt="" className="h-full w-full object-cover" />
        ) : (
          item.authorName.slice(0, 1).toUpperCase()
        )}
      </div>
    );
  }
  const look = {
    post_removed: { Icon: HiOutlineShieldCheck, ring: "rgba(248,113,113,0.35)", bg: "rgba(248,113,113,0.12)", color: "#fca5a5" },
    account_approved: { Icon: HiOutlineCheckBadge, ring: "rgba(16,185,129,0.35)", bg: "rgba(16,185,129,0.12)", color: "#6ee7b7" },
    report_handled: { Icon: HiOutlineFlag, ring: "rgba(201,150,63,0.35)", bg: "rgba(201,150,63,0.12)", color: "#d6bd97" },
  }[item.kind] || { Icon: HiOutlineBellAlert, ring: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.06)", color: "#f4e6cd" };
  const Icon = look.Icon;
  return (
    <div
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={{ border: `1px solid ${look.ring}`, background: look.bg }}
    >
      <Icon className="h-4 w-4" style={{ color: look.color }} />
    </div>
  );
}

function ActivityText({ item }) {
  const noun = item.itemType === "service" ? "service" : "listing";
  const meta = (label) => (
    <p className="mt-1 text-[11px] text-white/30">
      {label} · {timeAgo(item.createdAt)}
    </p>
  );

  if (item.kind === "question") {
    return (
      <>
        <p className="text-sm leading-5 text-white/70">
          <span className="font-semibold text-white">{item.authorName}</span>{" "}
          asked on{" "}
          <span className="font-semibold text-[#d6bd97]">{item.itemTitle}</span>
        </p>
        <p className="mt-1 line-clamp-2 break-words text-[13px] leading-5 text-white/45">“{item.text}”</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/30">
          <HiOutlineChatBubbleLeftRight className="h-3 w-3" />
          {item.itemType === "listing" ? "Listing" : "Service"} · {timeAgo(item.createdAt)}
        </p>
      </>
    );
  }

  if (item.kind === "post_removed") {
    return (
      <>
        <p className="text-sm leading-5 text-white/70">
          A moderator removed your {noun}{" "}
          <span className="font-semibold text-[#d6bd97]">{item.itemTitle}</span>
        </p>
        <p className="mt-1 text-[13px] leading-5 text-white/45">Reason: {removalReasonText(item.reason)}.</p>
        {meta("Moderation")}
      </>
    );
  }

  if (item.kind === "account_approved") {
    return (
      <>
        <p className="text-sm font-semibold leading-5 text-white">Your account was approved</p>
        <p className="mt-1 text-[13px] leading-5 text-white/45">Welcome to CampusHub! You can now post, save and ask questions.</p>
        {meta("Account")}
      </>
    );
  }

  if (item.kind === "report_handled") {
    const outcome =
      item.outcome === "dismissed"
        ? "We looked and left it up. Thanks for telling us."
        : item.outcome === "banned"
        ? "We took action. Thanks for keeping CampusHub safe."
        : "We removed it. Thanks for keeping CampusHub safe.";
    return (
      <>
        <p className="text-sm leading-5 text-white/70">
          Your report on <span className="font-semibold text-[#d6bd97]">{item.itemTitle}</span> was reviewed
        </p>
        <p className="mt-1 text-[13px] leading-5 text-white/45">{outcome}</p>
        {meta("Report")}
      </>
    );
  }

  return null;
}

/* ─── Stage 18b card pieces ─────────────────────────────────────── */
function CardHead({ eyebrow, title, linkTo, linkLabel }) {
  return (
    <div className="relative z-10 mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.38em] text-white/35">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>{title}</h3>
      </div>
      <Link
        to={linkTo}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#d6bd97] transition-colors hover:bg-[#c9963f]/12"
      >
        {linkLabel} <HiOutlineArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function RowSkeleton({ round = false }) {
  return (
    <div className="relative z-10 space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5">
          <div className={`h-11 w-11 shrink-0 animate-pulse bg-white/[0.08] ${round ? "rounded-full" : "rounded-xl"}`} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardMessage({ icon: Icon, text, sub, action }) {
  return (
    <div className="relative z-10 flex flex-col items-center rounded-[18px] border border-dashed border-white/[0.08] px-4 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05]">
        <Icon className="h-5 w-5 text-white/40" />
      </span>
      <p className="mt-3 text-sm font-semibold text-white/70">{text}</p>
      <p className="mt-1 max-w-[260px] text-sm leading-6 text-white/35">{sub}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-4 inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/75 transition hover:border-[#c9963f]/40 hover:text-[#f4e6cd]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

const STATUS_LOOK = {
  active: { label: "Active", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  sold: { label: "Sold", cls: "border-[#c9963f]/35 bg-[#c9963f]/12 text-[#e8c88f]" },
  paused: { label: "Paused", cls: "border-white/15 bg-white/[0.06] text-white/55" },
  removed: { label: "Removed", cls: "border-red-400/30 bg-red-400/10 text-red-300" },
};

function StatusChip({ post }) {
  const look = STATUS_LOOK[post.status] || STATUS_LOOK.active;
  const label = post.status === "removed" && post.removedByAdmin ? "Removed by mod" : look.label;
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${look.cls}`}>
      {label}
    </span>
  );
}
