import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  HiOutlineClock,
  HiOutlineNoSymbol,
  HiOutlineArrowLeftOnRectangle,
  HiOutlineExclamationTriangle,
  HiOutlineUserCircle,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import AppShell from "./AppShell";

/**
 * Gate — access-control wrapper for protected routes.
 *
 * Order of checks:
 *   1. Not logged in            → redirect to /login
 *   2. banned === true          → render Blocked screen (no children, ever)
 *   3. role === "admin"         → bypass the approval check (still subject to #2)
 *   4. approved !== true        → render Pending screen, UNLESS the current
 *                                 path is allowed for pending users (Profile)
 *   5. otherwise                → render children (inside the AppShell
 *                                 sidebar when `withShell` is set)
 *
 * App.jsx mounts ONE Gate as a layout route around every signed-in page,
 * so the account check and the sidebar persist while moving between pages.
 * The users/{uid} doc is watched live: approvals, bans, profile photo and
 * "mark all as read" show up without a reload.
 *
 * Props:
 *   allowUnapproved       pending users may see children on any path
 *   allowUnapprovedPaths  lower-case paths pending users may see (no shell)
 *   withShell             wrap approved users' pages in <AppShell>
 */
export default function Gate({ children, allowUnapproved = false, allowUnapprovedPaths = [], withShell = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("loading"); // loading | ok | pending | banned | error
  const [account, setAccount] = useState(null); // { uid, email, data }
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let unsubDoc = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }
      if (!user) {
        navigate("/login");
        return;
      }
      unsubDoc = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          // "estimate" so a just-written serverTimestamp (e.g. activitySeenAt)
          // reads as "now" instead of null while it's pending.
          const data = snap.exists() ? snap.data({ serverTimestamps: "estimate" }) : {};
          setAccount({ uid: user.uid, email: user.email, data });
          if (data.banned === true) setStatus("banned");
          else if (data.role === "admin" || data.approved === true) setStatus("ok");
          else setStatus("pending");
        },
        (err) => {
          console.error("Gate: couldn't verify account status:", err);
          setStatus("error");
        }
      );
    });
    return () => {
      if (unsubDoc) unsubDoc();
      unsubAuth();
    };
  }, [navigate]);

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

  const pendingAllowed =
    allowUnapproved || allowUnapprovedPaths.includes(location.pathname.toLowerCase());

  if (status === "loading") return <GateScreen loading />;
  if (status === "banned") return <GateScreen kind="banned" onLogout={handleLogout} loggingOut={loggingOut} />;
  if (status === "error") return <GateScreen kind="error" onLogout={handleLogout} loggingOut={loggingOut} />;
  if (status === "pending") {
    if (pendingAllowed) return children;
    return <GateScreen kind="pending" onLogout={handleLogout} loggingOut={loggingOut} />;
  }
  if (withShell) {
    return (
      <AppShell account={account} onLogout={handleLogout} loggingOut={loggingOut}>
        {children}
      </AppShell>
    );
  }
  return children;
}

/* ─── Shared full-screen message state ─────────────────────────── */
function GateScreen({ kind, loading, onLogout, loggingOut }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#0d0b07] px-4 text-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="w-full max-w-sm rounded-[24px] border border-white/[0.08] bg-white/[0.04] p-8 text-center backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        {loading ? (
          <>
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#c9963f]" />
            <p className="mt-4 text-sm text-white/40">Checking your account…</p>
          </>
        ) : kind === "banned" ? (
          <>
            <IconBadge icon={HiOutlineNoSymbol} tone="banned" />
            <h1 className="mt-4 text-xl font-bold" style={{ fontFamily: "'Inter', sans-serif" }}>
              Account suspended
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/50">
              This account has been banned from CampusHub. If you think this is a mistake, contact a campus admin.
            </p>
            <LogoutButton onClick={onLogout} busy={loggingOut} />
          </>
        ) : kind === "pending" ? (
          <>
            <IconBadge icon={HiOutlineClock} tone="pending" />
            <h1 className="mt-4 text-xl font-bold" style={{ fontFamily: "'Inter', sans-serif" }}>
              Awaiting approval
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Your account is waiting on approval from a CampusHub admin. You can finish setting up your profile in the meantime.
            </p>
            <Link
              to="/Profile"
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-sm font-bold uppercase tracking-[0.1em] text-[#f4e6cd] transition-all duration-300 hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a]"
            >
              <HiOutlineUserCircle className="h-4 w-4" />
              Finish your profile
            </Link>
            <LogoutButton onClick={onLogout} busy={loggingOut} subtle />
          </>
        ) : (
          <>
            <IconBadge icon={HiOutlineExclamationTriangle} tone="error" />
            <h1 className="mt-4 text-xl font-bold" style={{ fontFamily: "'Inter', sans-serif" }}>
              Couldn't verify your account
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Something went wrong checking your account status. Check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-sm font-bold uppercase tracking-[0.1em] text-[#f4e6cd] transition-all duration-300 hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a]"
            >
              Retry
            </button>
            <LogoutButton onClick={onLogout} busy={loggingOut} subtle />
          </>
        )}
      </div>
    </div>
  );
}

function IconBadge({ icon: Icon, tone }) {
  const styles = {
    banned: { border: "rgba(248,113,113,0.35)", bg: "rgba(248,113,113,0.12)", color: "#fca5a5" },
    pending: { border: "rgba(201,150,63,0.35)", bg: "rgba(201,150,63,0.12)", color: "#d6bd97" },
    error: { border: "rgba(248,113,113,0.35)", bg: "rgba(248,113,113,0.12)", color: "#fca5a5" },
  }[tone];
  return (
    <div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
      style={{ border: `1px solid ${styles.border}`, background: styles.bg }}
    >
      <Icon className="h-6 w-6" style={{ color: styles.color }} />
    </div>
  );
}

function LogoutButton({ onClick, busy, subtle }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={
        subtle
          ? "mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white/50 transition-all duration-200 hover:text-red-300 disabled:opacity-50"
          : "mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-red-400 transition-all duration-200 hover:bg-red-500/15 disabled:opacity-50"
      }
      style={subtle ? undefined : { border: "1px solid rgba(239,68,68,0.22)", background: "rgba(239,68,68,0.08)" }}
    >
      <HiOutlineArrowLeftOnRectangle className="h-4 w-4" />
      {busy ? "Logging out…" : "Logout"}
    </button>
  );
}
