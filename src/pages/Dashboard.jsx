import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import {
  HiOutlineShoppingBag,
  HiOutlineWrenchScrewdriver,
  HiOutlineUserCircle,
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
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import mascotGif from "../assets/TS.gif";
import dashboardBg from "../assets/dashboard-bg.jpg";
import { markActivityRead, timeAgo, useActivity } from "../utils/activity";

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
      })
      .catch((err) => {
        console.error("Couldn't count your posts:", err);
        // Fall back to the stored counters so the card still shows something.
        if (alive) setCounts({ fallback: true });
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

  const quickActions = [
    {
      title: "Marketplace",
      desc: "Browse the newest campus listings.",
      to: "/marketplace",
      icon: HiOutlineShoppingBag,
      accent: "#c9963f",
      accentBg: "rgba(201,150,63,0.10)",
    },
    {
      title: "Offer Services",
      desc: "Publish tutoring or campus services.",
      to: "/services",
      icon: HiOutlineWrenchScrewdriver,
      accent: "#8f774b",
      accentBg: "rgba(143,119,75,0.10)",
    },
    {
      title: "My Profile",
      desc: "Manage your personal account details.",
      to: "/Profile",
      icon: HiOutlineUserCircle,
      accent: "#d6bd97",
      accentBg: "rgba(214,189,151,0.10)",
    },
    {
      title: "Create Listing",
      desc: "Post your next item or service.",
      to: "/marketplace",
      icon: HiOutlinePlusCircle,
      accent: "#c9963f",
      accentBg: "rgba(201,150,63,0.10)",
    },
  ];

  // Questions other students asked on my listings and services (live).
  const { items: activity, loading: activityLoading, error: activityError } = useActivity(user?.uid);
  const isUnread = (a) => !seenAt || (a.createdAt && a.createdAt > seenAt);
  const unreadCount = activity.filter(isUnread).length;

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
    { label: "Listings", value: useStored ? profile?.listingsCount ?? 0 : counts?.listings ?? 0, icon: HiOutlineShoppingBag, to: "/marketplace" },
    { label: "Services", value: useStored ? profile?.servicesCount ?? 0 : counts?.services ?? 0, icon: HiOutlineWrenchScrewdriver, to: "/services" },
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

          {/* Welcome card */}
          <div
            className={`${card} p-8 transition-all duration-700 ${
              show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
          >
            <TopLine via="rgba(143,119,75,0.45)" t="rgba(201,150,63,0.35)" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-xl">
                <p className="text-[11px] uppercase tracking-[0.42em] text-white/35">
                  {getGreeting()}
                </p>
                <h2 className="mt-3 text-4xl font-bold leading-tight text-white sm:text-5xl" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {loadingProfile ? (
                    <span className="inline-block h-11 w-52 animate-pulse rounded-xl bg-white/10" />
                  ) : (
                    username
                  )}
                </h2>
                <p className="mt-4 max-w-md text-[15px] leading-7 text-white/50">
                  Your campus space is ready. Browse listings, offer services, and build your student marketplace presence.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    to="/marketplace"
                    className="group inline-flex h-11 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-6 text-sm font-bold uppercase tracking-[0.14em] text-[#f4e6cd] transition-all duration-300 hover:-translate-y-1 hover:from-[#9c8352] hover:to-[#d6a24a] hover:shadow-[0_12px_28px_rgba(143,119,75,0.45)] active:scale-[0.97]"
                  >
                    <HiOutlineSparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                    Explore
                  </Link>
                  <Link
                    to="/Profile"
                    className="inline-flex h-11 items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-6 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.09]"
                  >
                    <HiOutlineUserCircle className="h-4 w-4" />
                    Profile
                  </Link>
                </div>
              </div>

              <div className="relative mx-auto w-fit shrink-0">
                <img
                  src={mascotGif}
                  alt="CampusHub mascot"
                  className="animate-mascot-bob relative z-10 w-[150px] opacity-90 drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-[1.06] sm:w-[200px]"
                />
              </div>
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

        {/* ── Content row ── */}
        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_0.9fr]">

          {/* Quick actions */}
          <div
            className={`${card} p-7 transition-all duration-700 delay-150 ${
              show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
          >
            <TopLine via="rgba(143,119,75,0.45)" />

            <div className="relative z-10">
              <div className="mb-6">
                <p className="text-[11px] uppercase tracking-[0.38em] text-white/35">
                  What's next
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Quick Actions</h3>
              </div>

              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                {quickActions.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.title}
                      to={action.to}
                      className="group relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.03] px-5 py-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
                      style={{ transitionDelay: `${i * 35}ms` }}
                    >
                      {/* hover accent fill */}
                      <div
                        className="absolute inset-0 rounded-[20px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{ background: action.accentBg }}
                      />
                      {/* left accent bar */}
                      <div
                        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full opacity-0 transition-all duration-300 group-hover:opacity-100"
                        style={{ background: action.accent }}
                      />

                      <div className="relative z-10 flex items-center gap-4">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] transition-transform duration-300 group-hover:scale-110"
                        >
                          <Icon className="h-5 w-5" style={{ color: action.accent, opacity: 0.9 }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-[15px] font-semibold text-white">{action.title}</h4>
                          <p className="mt-0.5 text-sm text-white/45">{action.desc}</p>
                        </div>

                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/40 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white/70"
                        >
                          <HiOutlineArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

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
                <ul className="-mr-2 max-h-[420px] space-y-2.5 overflow-y-auto pr-2">
                  {activity.map((item, i) => {
                    const unread = isUnread(item);
                    return (
                      <li
                        key={`${item.itemId}-${item.id}`}
                        style={{
                          opacity: show ? 1 : 0,
                          transform: show ? "translateX(0)" : "translateX(-10px)",
                          transition: `opacity 0.5s ease ${350 + Math.min(i, 6) * 70}ms, transform 0.5s ease ${350 + Math.min(i, 6) * 70}ms`,
                        }}
                      >
                        <Link
                          to={item.to}
                          className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/[0.12] ${
                            unread ? "border-[#c9963f]/25 bg-[#c9963f]/[0.06]" : "border-white/[0.06] bg-white/[0.03]"
                          }`}
                        >
                          <div className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-xs font-bold text-[#f4e6cd]">
                            {item.authorPhoto ? (
                              <img src={item.authorPhoto} alt="" className="h-full w-full object-cover" />
                            ) : (
                              item.authorName.slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-5 text-white/70">
                              <span className="font-semibold text-white">{item.authorName}</span>{" "}
                              asked on{" "}
                              <span className="font-semibold text-[#d6bd97]">{item.itemTitle}</span>
                            </p>
                            <p className="mt-1 line-clamp-2 break-words text-[13px] leading-5 text-white/45">
                              “{item.text}”
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/30">
                              <HiOutlineChatBubbleLeftRight className="h-3 w-3" />
                              {item.itemType === "listing" ? "Listing" : "Service"} · {timeAgo(item.createdAt)}
                            </p>
                          </div>
                          {unread && (
                            <span
                              className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#c9963f] shadow-[0_0_6px_#c9963f]"
                              aria-label="Unread"
                            />
                          )}
                        </Link>
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
                    Questions on your listings and services will show up here.
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
