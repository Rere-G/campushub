import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  HiOutlineShoppingBag,
  HiOutlineWrenchScrewdriver,
  HiOutlineUserCircle,
  HiOutlinePlusCircle,
  HiOutlineArrowRight,
  HiOutlineBookmark,
  HiOutlineSparkles,
  HiOutlineBellAlert,
  HiOutlineArrowLeftOnRectangle,
  HiOutlineCheckBadge,
  HiOutlineShieldCheck,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import mascotGif from "../assets/TS.gif";
import dashboardBg from "../assets/dashboard-bg.jpg";

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
function StatCard({ label, value, icon: Icon, show, delay = 0 }) {
  const num = parseInt(value, 10) || 0;
  const count = useCountUp(num, 1000, show);
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 text-center transition-all duration-500 hover:-translate-y-1.5 hover:border-white/20 hover:bg-white/[0.08] hover:shadow-[0_14px_28px_rgba(0,0,0,0.3)]"
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
        {String(count).padStart(2, "0")}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
    </div>
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 120);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { navigate("/login"); return; }
      setUser(currentUser);
      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        setProfile(snap.exists() ? snap.data() : null);
      } catch (err) {
        console.error("Error loading profile:", err);
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [navigate]);

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

  // No real activity source yet — empty until notifications/listings exist.
  const recentActivity = [];

  const stats = [
    { label: "Listings", value: profile?.listingsCount ?? 0, icon: HiOutlineShoppingBag },
    { label: "Services", value: profile?.servicesCount ?? 0, icon: HiOutlineWrenchScrewdriver },
    { label: "Saved", value: profile?.savedCount ?? 0, icon: HiOutlineBookmark },
  ];

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error(err);
      setLoggingOut(false);
    }
  };

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
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl" style={{ fontFamily: "'Inter', sans-serif" }}>
                Dashboard
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {[
                { to: "/marketplace", icon: HiOutlineShoppingBag, label: "Marketplace" },
                { to: "/services", icon: HiOutlineWrenchScrewdriver, label: "Services" },
              ].map(({ to, icon: Icon, label }) => (
                <Link
                  key={label}
                  to={to}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 text-sm font-medium text-white/70 transition-all duration-250 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white hover:shadow-[0_6px_18px_rgba(0,0,0,0.3)]"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#d6bd97] transition-all duration-250 hover:-translate-y-0.5 hover:bg-[#c9963f]/15"
                  style={{ border: "1px solid rgba(201,150,63,0.35)", background: "rgba(201,150,63,0.10)" }}
                >
                  <HiOutlineShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-red-400 transition-all duration-250 hover:-translate-y-0.5 hover:bg-red-500/15 hover:shadow-[0_6px_18px_rgba(239,68,68,0.18)] active:scale-[0.97] disabled:opacity-50"
                style={{ border: "1px solid rgba(239,68,68,0.22)", background: "rgba(239,68,68,0.08)" }}
              >
                <HiOutlineArrowLeftOnRectangle className="h-4 w-4" />
                {loggingOut ? "Logging out…" : "Logout"}
              </button>
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
                  <StatCard key={item.label} {...item} show={show} delay={300 + i * 80} />
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
            className={`${card} p-7 transition-all duration-700 delay-200 ${
              show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
          >
            <TopLine via="rgba(214,189,151,0.45)" />

            <div className="relative z-10">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.38em] text-white/35">
                    Notifications
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Activity</h3>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05]">
                  <HiOutlineBellAlert className="h-4 w-4 text-white/50" />
                </div>
              </div>

              {recentActivity.length > 0 ? (
                <div className="space-y-2.5">
                  {recentActivity.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3.5 rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-4 transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.10]"
                      style={{
                        opacity: show ? 1 : 0,
                        transform: show ? "translateX(0)" : "translateX(-10px)",
                        transition: `opacity 0.5s ease ${350 + i * 90}ms, transform 0.5s ease ${350 + i * 90}ms, background 0.25s, border-color 0.25s`,
                      }}
                    >
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                        style={{ border: `1px solid ${item.color}28`, background: `${item.color}12` }}
                      >
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-6 text-white/60">{item.text}</p>
                        <p className="mt-0.5 text-[11px] text-white/28">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
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
                    Your notifications, listing views, and messages will show up here as you use CampusHub.
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
