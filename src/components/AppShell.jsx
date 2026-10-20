import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  HiOutlineArrowLeftOnRectangle,
  HiOutlineBookmark,
  HiOutlineChatBubbleLeftRight,
  HiOutlineChevronDoubleLeft,
  HiOutlineChevronDoubleRight,
  HiOutlineHome,
  HiOutlinePlus,
  HiOutlineShieldCheck,
  HiOutlineShoppingBag,
  HiOutlineUserCircle,
  HiOutlineWrenchScrewdriver,
  HiOutlineXMark,
} from "react-icons/hi2";
import { useActivity } from "../utils/activity";

const inter = { fontFamily: "'Inter', sans-serif" };
const COLLAPSE_KEY = "ch.sidebar.collapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const POST_OPTIONS = [
  { to: "/marketplace/new", label: "Sell an item", desc: "Books, electronics, dorm gear…", icon: HiOutlineShoppingBag },
  { to: "/services/new", label: "Offer a service", desc: "Tutoring, design, repairs…", icon: HiOutlineWrenchScrewdriver },
];

// The frame around every signed-in page: a sidebar on desktop (collapsible
// to icons, remembered in this browser) and a bottom tab bar on phones.
// Rendered by Gate once per session, so it stays put between pages.
// Props:
//   account   { uid, email, data } — data is the live users/{uid} doc
//   onLogout  () => void
//   loggingOut boolean
export default function AppShell({ account, onLogout, loggingOut, children }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [postOpen, setPostOpen] = useState(false);
  const [meOpen, setMeOpen] = useState(false);

  const data = account?.data || {};
  const isAdmin = data.role === "admin";
  const name =
    data.username?.trim() || data.fullName?.trim() || account?.email?.split("@")[0] || "Student";
  const photo = /^https?:\/\//i.test(data.profilePhoto || "") ? data.profilePhoto : "";

  // Unread questions on my items — same rule as the Dashboard Activity card.
  const { items } = useActivity(account?.uid);
  const seenAt = data.activitySeenAt?.toDate?.() ?? null;
  const unread = items.filter((a) => !seenAt || (a.createdAt && a.createdAt > seenAt)).length;

  // Close menus whenever the page changes. Done during render (not in an
  // effect) by remembering which path the menus were opened on.
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setPostOpen(false);
    setMeOpen(false);
  }

  // Escape closes any open menu.
  useEffect(() => {
    if (!postOpen && !meOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setPostOpen(false);
        setMeOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [postOpen, meOpen]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* storage blocked: still works for this visit */
      }
      return next;
    });
  };

  return (
    <div className="relative flex min-h-screen bg-[#0d0b07] text-white" style={inter}>
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        isAdmin={isAdmin}
        unread={unread}
        name={name}
        photo={photo}
        postOpen={postOpen}
        setPostOpen={setPostOpen}
        onLogout={onLogout}
        loggingOut={loggingOut}
      />

      {/* Page. Bottom padding on phones so nothing hides behind the tab bar. */}
      <main className="min-w-0 flex-1 pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
        {children}
      </main>

      <BottomBar
        unread={unread}
        postOpen={postOpen}
        setPostOpen={setPostOpen}
        meOpen={meOpen}
        setMeOpen={setMeOpen}
      />

      {meOpen && (
        <MeSheet
          name={name}
          photo={photo}
          isAdmin={isAdmin}
          onClose={() => setMeOpen(false)}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      )}
    </div>
  );
}

/* ─── Shared bits ─────────────────────────────────────────────── */

function Avatar({ name, photo, size = "h-9 w-9", text = "text-sm" }) {
  return (
    <span
      className={`${size} ${text} flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-[#f4e6cd]`}
      style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
    >
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
    </span>
  );
}

function Badge({ n, className = "" }) {
  if (!n) return null;
  return (
    <span
      className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c9963f] px-1 text-[10px] font-bold text-[#1a120a] ${className}`}
      aria-label={`${n} unread`}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function PostMenu({ onClose, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    // Next tick, so the click that opened the menu doesn't close it.
    const t = setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="What do you want to post?"
      className={`z-50 w-64 rounded-2xl border border-white/10 bg-[#15110b] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] ${className}`}
    >
      {POST_OPTIONS.map((o) => {
        const Icon = o.icon;
        return (
          <Link
            key={o.to}
            to={o.to}
            role="menuitem"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:bg-white/[0.08]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#c9963f]/30 bg-[#c9963f]/10">
              <Icon className="h-4 w-4 text-[#d6bd97]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{o.label}</span>
              <span className="block truncate text-xs text-white/40">{o.desc}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Desktop sidebar ─────────────────────────────────────────── */

function Sidebar({ collapsed, onToggle, isAdmin, unread, name, photo, postOpen, setPostOpen, onLogout, loggingOut }) {
  const width = collapsed ? "w-[76px]" : "w-[244px]";

  const menu = [
    { to: "/dashboard", label: "Dashboard", icon: HiOutlineHome, badge: unread },
    { to: "/marketplace", label: "Marketplace", icon: HiOutlineShoppingBag },
    { to: "/services", label: "Services", icon: HiOutlineWrenchScrewdriver },
  ];
  const mine = [{ to: "/saved", label: "Saved", icon: HiOutlineBookmark }];

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/[0.07] bg-[#0a0805]/95 transition-[width] duration-300 md:flex ${width}`}
      aria-label="Main navigation"
    >
      {/* Brand + collapse toggle */}
      <div className={`flex items-center gap-2.5 px-4 pb-4 pt-5 ${collapsed ? "flex-col" : ""}`}>
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="CampusHub dashboard">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-[#1a120a]"
            style={{ background: "linear-gradient(135deg,#d6bd97,#c9963f)" }}
          >
            C
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight text-white">CampusHub</span>
              <span className="block truncate text-[11px] text-white/35">Student marketplace</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white ${
            collapsed ? "" : "ml-auto"
          }`}
        >
          {collapsed ? <HiOutlineChevronDoubleRight className="h-4 w-4" /> : <HiOutlineChevronDoubleLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 px-3">
        <SectionLabel collapsed={collapsed}>Menu</SectionLabel>
        {menu.map((item) => (
          <SideLink key={item.to} item={item} collapsed={collapsed} />
        ))}
        <SoonItem collapsed={collapsed} />

        <SectionLabel collapsed={collapsed} className="mt-4">My stuff</SectionLabel>
        {mine.map((item) => (
          <SideLink key={item.to} item={item} collapsed={collapsed} />
        ))}

        {/* Post */}
        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setPostOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={postOpen}
            title={collapsed ? "Post" : undefined}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-sm font-bold uppercase tracking-[0.08em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6bd97]/70`}
          >
            <HiOutlinePlus className="h-4 w-4" />
            {!collapsed && "Post"}
          </button>
          {postOpen && (
            <PostMenu
              onClose={() => setPostOpen(false)}
              className={collapsed ? "absolute left-full top-0 ml-3" : "absolute left-0 top-full mt-2"}
            />
          )}
        </div>
      </nav>

      {/* Bottom: admin + profile chip */}
      <div className="flex flex-col gap-1 border-t border-white/[0.07] px-3 py-3">
        {isAdmin && (
          <SideLink item={{ to: "/admin", label: "Admin", icon: HiOutlineShieldCheck }} collapsed={collapsed} />
        )}
        <div className={`flex items-center gap-2 rounded-xl ${collapsed ? "flex-col" : ""}`}>
          <NavLink
            to="/Profile"
            title={collapsed ? `${name} · Profile` : undefined}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-white/[0.06] ${
                isActive ? "bg-white/[0.06]" : ""
              } ${collapsed ? "justify-center" : ""}`
            }
          >
            <Avatar name={name} photo={photo} />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{name}</span>
                <span className="block truncate text-[11px] text-white/40">{isAdmin ? "Admin" : "Student"} · Profile</span>
              </span>
            )}
          </NavLink>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            aria-label="Log out"
            title="Log out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
          >
            <HiOutlineArrowLeftOnRectangle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ collapsed, className = "", children }) {
  if (collapsed) return <div className={`mx-auto my-2 h-px w-6 bg-white/10 ${className}`} aria-hidden="true" />;
  return (
    <p className={`px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/30 ${className}`}>
      {children}
    </p>
  );
}

function SideLink({ item, collapsed }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60 ${
          collapsed ? "justify-center px-0" : ""
        } ${
          isActive
            ? "bg-[#c9963f]/[0.12] text-[#f4e6cd]"
            : "text-white/55 hover:bg-white/[0.05] hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-[#c9963f]" aria-hidden="true" />}
          <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-[#d6bd97]" : ""}`} />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {item.badge ? (
            <Badge n={item.badge} className={collapsed ? "absolute right-2 top-1.5" : "ml-auto"} />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function SoonItem({ collapsed }) {
  return (
    <div
      aria-disabled="true"
      title={collapsed ? "Messages — coming soon" : undefined}
      className={`flex h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/30 ${
        collapsed ? "justify-center px-0" : ""
      }`}
    >
      <HiOutlineChatBubbleLeftRight className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <>
          <span>Messages</span>
          <span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Soon
          </span>
        </>
      )}
    </div>
  );
}

/* ─── Phone bottom bar ────────────────────────────────────────── */

function BottomBar({ unread, postOpen, setPostOpen, meOpen, setMeOpen }) {
  const tab = (isActive) =>
    `relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
      isActive ? "text-[#d6bd97]" : "text-white/45"
    }`;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0a0805]/95 backdrop-blur-xl md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="relative flex h-[64px] items-stretch">
        <NavLink to="/dashboard" className={({ isActive }) => tab(isActive)}>
          <span className="relative">
            <HiOutlineHome className="h-5 w-5" />
            <Badge n={unread} className="absolute -right-3 -top-2" />
          </span>
          Home
        </NavLink>
        <NavLink to="/marketplace" className={({ isActive }) => tab(isActive)}>
          <HiOutlineShoppingBag className="h-5 w-5" />
          Market
        </NavLink>

        <div className="relative flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => setPostOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={postOpen}
            aria-label="Post"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8f774b] to-[#c9963f] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.45)] transition-transform active:scale-95"
          >
            {postOpen ? <HiOutlineXMark className="h-6 w-6" /> : <HiOutlinePlus className="h-6 w-6" />}
          </button>
          {postOpen && (
            <PostMenu
              onClose={() => setPostOpen(false)}
              className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2"
            />
          )}
        </div>

        <NavLink to="/services" className={({ isActive }) => tab(isActive)}>
          <HiOutlineWrenchScrewdriver className="h-5 w-5" />
          Services
        </NavLink>
        <button
          type="button"
          onClick={() => setMeOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={meOpen}
          className={tab(meOpen)}
        >
          <HiOutlineUserCircle className="h-5 w-5" />
          Me
        </button>
      </div>
    </nav>
  );
}

function MeSheet({ name, photo, isAdmin, onClose, onLogout, loggingOut }) {
  const navigate = useNavigate();
  const go = (to) => {
    onClose();
    navigate(to);
  };
  const rowBase = "flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors";
  const row = `${rowBase} text-white/80 hover:bg-white/[0.06]`;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Your account">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[24px] border-t border-white/10 bg-[#15110b] px-4 pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />
        <div className="mb-2 flex items-center gap-3 px-1">
          <Avatar name={name} photo={photo} size="h-11 w-11" text="text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">{name}</p>
            <p className="text-xs text-white/40">{isAdmin ? "Admin" : "Student"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white/50 hover:bg-white/[0.06]"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          <button type="button" className={row} onClick={() => go("/saved")}>
            <HiOutlineBookmark className="h-5 w-5 text-[#d6bd97]" /> Saved
          </button>
          <div className={`${rowBase} cursor-not-allowed text-white/30`} aria-disabled="true">
            <HiOutlineChatBubbleLeftRight className="h-5 w-5" /> Messages
            <span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Soon
            </span>
          </div>
          <button type="button" className={row} onClick={() => go("/Profile")}>
            <HiOutlineUserCircle className="h-5 w-5 text-[#d6bd97]" /> Profile
          </button>
          {isAdmin && (
            <button type="button" className={row} onClick={() => go("/admin")}>
              <HiOutlineShieldCheck className="h-5 w-5 text-[#d6bd97]" /> Admin
            </button>
          )}
          <div className="my-1 h-px bg-white/[0.07]" />
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className={`${rowBase} text-red-300 hover:bg-red-500/10 disabled:opacity-50`}
          >
            <HiOutlineArrowLeftOnRectangle className="h-5 w-5" /> {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}
