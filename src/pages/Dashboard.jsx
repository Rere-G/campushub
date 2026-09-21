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

  const quickActions = [
    {
      title: "Marketplace",
      desc: "Browse the newest campus listings.",
      to: "/marketplace",
      icon: HiOutlineShoppingBag,
      accent: "#6366F1",
      accentBg: "rgba(99,102,241,0.10)",
      accentBorder: "rgba(99,102,241,0.25)",
    },
    {
      title: "Offer Services",
      desc: "Publish tutoring or campus services.",
      to: "/services",
      icon: HiOutlineWrenchScrewdriver,
      accent: "#F59E0B",
      accentBg: "rgba(245,158,11,0.10)",
      accentBorder: "rgba(245,158,11,0.25)",
    },
    {
      title: "My Profile",
      desc: "Manage your personal account details.",
      to: "/Profile",
      icon: HiOutlineUserCircle,
      accent: "#10B981",
      accentBg: "rgba(16,185,129,0.10)",
      accentBorder: "rgba(16,185,129,0.25)",
    },
    {
      title: "Create Listing",
      desc: "Post your next item or service.",
      to: "/marketplace",
      icon: HiOutlinePlusCircle,
      accent: "#F472B6",
      accentBg: "rgba(244,114,182,0.10)",
      accentBorder: "rgba(244,114,182,0.25)",
    },
  ];

  const recentActivity = [
    { text: "Your dashboard is ready for marketplace activity.", time: "Just now", color: "#6366F1" },
    { text: "Browse, post, and manage campus listings anytime.", time: "2m ago", color: "#F59E0B" },
    { text: "Complete your profile to build trust on the platform.", time: "5m ago", color: "#10B981" },
  ];

  const stats = [
    { label: "Listings", value: "03", icon: HiOutlineShoppingBag },
    { label: "Services", value: "02", icon: HiOutlineWrenchScrewdriver },
    { label: "Saved", value: "05", icon: HiOutlineBookmark },
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
    <div className="relative min-h-screen overflow-hidden bg-[#07090D] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── BG image ── */}
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${dashboardBg})` }}
      />
      <div className="absolute inset-0 bg-black/80" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/65 to-black/95" />

      {/* ── Ambient orbs ── */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 h-[640px] w-[640px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-52 right-1/4 h-[560px] w-[560px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Profile incomplete banner ── */}
        {!loadingProfile && !profileCompleted && (
          <div
            className="mb-4 flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5 transition-all duration-700"
            style={{
              border: "1px solid rgba(245,158,11,0.25)",
              background: "rgba(245,158,11,0.07)",
              opacity: show ? 1 : 0,
              transform: show ? "translateY(0)" : "translateY(-8px)",
              transition: "opacity 0.6s ease, transform 0.6s ease",
            }}
          >
            <div className="flex items-center gap-3">
              <HiOutlineSparkles className="h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-sm text-amber-300/80">
                Your profile is incomplete — finish it to build trust with buyers and sellers.
              </p>
            </div>
            <Link
              to="/Profile"
              className="shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 transition-all hover:bg-amber-400/15"
              style={{ border: "1px solid rgba(245,158,11,0.3)" }}
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
          <TopLine via="rgba(99,102,241,0.55)" />

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] uppercase tracking-[0.38em] text-white/35">CampusHub</p>
                {isAdmin && (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300"
                    style={{ border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.12)" }}
                  >
                    <HiOutlineShieldCheck className="h-3 w-3" /> Admin
                  </span>
                )}
                {isApproved && !isAdmin && (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
                    style={{ border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.10)" }}
                  >
                    <HiOutlineCheckBadge className="h-3 w-3" /> Verified
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
            <TopLine via="rgba(99,102,241,0.45)" t="rgba(244,114,182,0.35)" />
            {/* inner corner glow */}
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)" }}
            />

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
                    className="group inline-flex h-11 items-center gap-2.5 rounded-2xl px-6 text-sm font-bold uppercase tracking-[0.14em] text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(99,102,241,0.45)] active:scale-[0.97]"
                    style={{ background: "linear-gradient(135deg, #818CF8 0%, #6366F1 100%)" }}
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
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-35"
                  style={{ background: "radial-gradient(circle, #6366F1, #F472B6)" }}
                />
                <img
                  src={mascotGif}
                  alt="CampusHub mascot"
                  className="relative z-10 w-[150px] opacity-90 drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-[1.06] sm:w-[200px]"
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
            <TopLine via="rgba(16,185,129,0.45)" />

            <div className="relative z-10 flex h-full flex-col">
              {/* Avatar + info */}
              <div className="flex items-start gap-4">
                <div
                  className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                  style={{
                    background: "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(244,114,182,0.22))",
                    border: "1px solid rgba(99,102,241,0.28)",
                  }}
                >
                  {username?.slice(0, 1)?.toUpperCase() || "U"}
                  {/* online dot */}
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#07090D] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
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
                      Student
                    </span>
                    {isApproved && (
                      <span
                        className="inline-flex h-6 items-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400"
                        style={{ border: "1px solid rgba(16,185,129,0.28)", background: "rgba(16,185,129,0.10)" }}
                      >
                        <HiOutlineCheckBadge className="h-3 w-3" /> Verified
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
                  style={{ border: "1px solid rgba(245,158,11,0.18)", background: "rgba(245,158,11,0.05)" }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400/70">
                      Profile
                    </p>
                    <p className="text-xs text-amber-400/50">60%</p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full transition-all duration-[1200ms] ease-out"
                      style={{
                        width: show ? "60%" : "0%",
                        background: "linear-gradient(90deg, #F59E0B, #FCD34D)",
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
            <TopLine via="rgba(244,114,182,0.40)" />

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
            <TopLine via="rgba(245,158,11,0.45)" />

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

              <div
                className="mt-4 rounded-[18px] border border-dashed px-4 py-4"
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                <p className="text-sm leading-6 text-white/30">
                  Real notifications, listing views, and messages will appear here.
                </p>
              </div>
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
