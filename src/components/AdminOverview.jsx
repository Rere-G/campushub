import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HiOutlineArrowRight,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineFlag,
  HiOutlineSquares2X2,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { db } from "../services/firebase";
import { CATEGORIES } from "../constants/categories";
import { SERVICE_CATEGORIES } from "../constants/serviceCategories";

// Stage 18c-1: admin Overview — KPI tiles, a 30-day activity chart, posts by
// category, and a "needs attention" list. Loaded only on the Admin page.

const inter = { fontFamily: "'Inter', sans-serif" };
const DAY = 24 * 60 * 60 * 1000;
const GOLD = "#c9963f";
const SAND = "#d6bd97";
const BRONZE = "#8f774b";
const prefersReduced =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// createdAt is a Firestore Timestamp on most docs, an ISO string on a few old ones.
const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const nameOf = (u) =>
  (u.fullName && u.fullName.trim()) || (u.username && u.username.trim()) || (u.email ? u.email.split("@")[0] : "Student");
const waited = (d, now) => {
  if (!d) return "";
  const days = Math.floor((now - d.getTime()) / DAY);
  if (days < 1) return "today";
  return days === 1 ? "1 day" : `${days} days`;
};
const stripEmoji = (label) => label.replace(/^\S+\s/, "");

export default function AdminOverview({ users, openReports, onGo }) {
  const [now] = useState(() => Date.now());
  const [posts, setPosts] = useState(null); // null loading | "error" | []

  // Listings + services, loaded once when the Overview opens.
  useEffect(() => {
    let alive = true;
    Promise.all([getDocs(collection(db, "listings")), getDocs(collection(db, "services"))])
      .then(([ls, ss]) => {
        if (!alive) return;
        setPosts([
          ...ls.docs.map((d) => ({ id: d.id, kind: "listing", ...d.data() })),
          ...ss.docs.map((d) => ({ id: d.id, kind: "service", ...d.data() })),
        ]);
      })
      .catch((err) => {
        console.error("Overview posts load failed:", err);
        if (alive) setPosts("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const postsReady = Array.isArray(posts);
  const weekAgo = now - 7 * DAY;

  const kpi = useMemo(() => {
    const pending = users.filter((u) => !u.approved && !u.banned);
    const students = users.filter((u) => u.approved && !u.banned && u.role !== "admin");
    const newStudents = users.filter((u) => (toDate(u.createdAt)?.getTime() || 0) > weekAgo).length;
    const oldestPending = pending
      .map((u) => toDate(u.createdAt))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    const active = postsReady ? posts.filter((p) => p.status === "active").length : null;
    const newPosts = postsReady ? posts.filter((p) => (toDate(p.createdAt)?.getTime() || 0) > weekAgo).length : null;
    return { pending: pending.length, students: students.length, newStudents, oldestPending, active, newPosts };
  }, [users, posts, postsReady, weekAgo]);

  // Last 30 days: sign-ups and new posts per day.
  const series = useMemo(() => {
    const start = new Date(now - 29 * DAY);
    start.setHours(0, 0, 0, 0);
    const days = [];
    const index = new Map();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start.getTime() + i * DAY);
      index.set(dayKey(d), days.length);
      days.push({ label: d.toLocaleDateString([], { day: "numeric", month: "short" }), signups: 0, posts: 0 });
    }
    const bump = (v, field) => {
      const d = toDate(v);
      if (!d) return;
      const i = index.get(dayKey(d));
      if (i !== undefined) days[i][field] += 1;
    };
    users.forEach((u) => bump(u.createdAt, "signups"));
    if (postsReady) posts.forEach((p) => bump(p.createdAt, "posts"));
    return days;
  }, [users, posts, postsReady, now]);

  const totals = useMemo(
    () => series.reduce((t, d) => ({ signups: t.signups + d.signups, posts: t.posts + d.posts }), { signups: 0, posts: 0 }),
    [series]
  );

  // Posts by category (listings and services), biggest first.
  const byCategory = useMemo(() => {
    if (!postsReady) return [];
    const rows = [
      ...CATEGORIES.map((c) => ({ key: `l-${c.key}`, name: stripEmoji(c.label), kind: "Listings", match: (p) => p.kind === "listing" && p.category === c.key })),
      ...SERVICE_CATEGORIES.map((c) => ({ key: `s-${c.key}`, name: stripEmoji(c.label), kind: "Services", match: (p) => p.kind === "service" && p.category === c.key })),
    ].map((r) => {
      const n = posts.filter((p) => p.status !== "removed" && r.match(p)).length;
      return { name: r.name, Listings: r.kind === "Listings" ? n : 0, Services: r.kind === "Services" ? n : 0, total: n };
    });
    return rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [posts, postsReady]);

  const pendingQueue = useMemo(
    () =>
      users
        .filter((u) => !u.approved && !u.banned)
        .map((u) => ({ ...u, since: toDate(u.createdAt) }))
        .sort((a, b) => (a.since?.getTime() || 0) - (b.since?.getTime() || 0))
        .slice(0, 4),
    [users]
  );

  const tiles = [
    {
      label: "Pending approval",
      value: kpi.pending,
      sub: kpi.pending ? `Oldest waiting ${waited(kpi.oldestPending, now) || "—"}` : "All caught up",
      icon: HiOutlineClock,
      tone: kpi.pending ? "warn" : "ok",
      go: () => onGo("users", "pending"),
    },
    {
      label: "Students",
      value: kpi.students,
      sub: `+${kpi.newStudents} signed up this week`,
      icon: HiOutlineUserGroup,
      go: () => onGo("users", "approved"),
    },
    {
      label: "Active posts",
      value: kpi.active,
      sub: kpi.newPosts === null ? "Loading…" : `+${kpi.newPosts} posted this week`,
      icon: HiOutlineSquares2X2,
      go: () => onGo("posts"),
    },
    {
      label: "Open reports",
      value: openReports,
      sub: openReports ? "Needs review" : "All clear",
      icon: HiOutlineFlag,
      tone: openReports ? "alert" : "ok",
      go: () => onGo("reports"),
    },
  ];

  return (
    <div className="relative z-10 space-y-5" style={inter}>
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.go}
            className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c9963f]/35 hover:bg-white/[0.06] motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{t.label}</span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                  t.tone === "alert"
                    ? "border-red-400/30 bg-red-400/10 text-red-300"
                    : t.tone === "warn"
                    ? "border-[#c9963f]/35 bg-[#c9963f]/12 text-[#e8c88f]"
                    : "border-white/10 bg-white/[0.05] text-white/55"
                }`}
              >
                <t.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-white">
              {t.value === null ? <span className="text-white/25">–</span> : t.value}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-white/40">
              {t.sub}
              <HiOutlineArrowRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </p>
          </button>
        ))}
      </div>

      {/* Activity chart */}
      <Panel
        title="Activity"
        sub="Last 30 days"
        right={
          <div className="flex gap-4 text-right">
            <Total color={SAND} label="Sign-ups" value={totals.signups} />
            <Total color={GOLD} label="New posts" value={postsReady ? totals.posts : "–"} />
          </div>
        }
      >
        {posts === "error" && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-red-300/80">
            <HiOutlineExclamationTriangle className="h-3.5 w-3.5" /> Couldn't load posts; showing sign-ups only.
          </p>
        )}
        <div className="h-[240px] w-full" role="img" aria-label={`Line chart: ${totals.signups} sign-ups and ${totals.posts} new posts in the last 30 days`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SAND} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SAND} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgba(244,230,205,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis allowDecimals={false} tick={{ fill: "rgba(244,230,205,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(214,189,151,0.25)" }} />
              <Area type="monotone" dataKey="signups" name="Sign-ups" stroke={SAND} strokeWidth={2} fill="url(#gSignups)" isAnimationActive={!prefersReduced} />
              {postsReady && (
                <Area type="monotone" dataKey="posts" name="New posts" stroke={GOLD} strokeWidth={2} fill="url(#gPosts)" isAnimationActive={!prefersReduced} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Posts by category */}
        <Panel title="Posts by category" sub="Live and sold posts">
          {posts === null ? (
            <div className="h-[260px] animate-pulse rounded-xl bg-white/[0.03]" />
          ) : posts === "error" ? (
            <Empty text="Couldn't load posts." />
          ) : byCategory.length === 0 ? (
            <Empty text="No posts yet." />
          ) : (
            <div style={{ height: Math.max(160, byCategory.length * 36 + 40) }} role="img" aria-label="Bar chart of posts by category">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={8}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "rgba(244,230,205,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={158} tick={{ fill: "rgba(244,230,205,0.7)", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(201,150,63,0.06)" }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "rgba(244,230,205,0.6)" }} iconType="circle" iconSize={8} />
                  <Bar dataKey="Listings" stackId="a" fill={GOLD} radius={[0, 6, 6, 0]} isAnimationActive={!prefersReduced} />
                  <Bar dataKey="Services" stackId="a" fill={BRONZE} radius={[0, 6, 6, 0]} isAnimationActive={!prefersReduced} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        {/* Needs attention */}
        <Panel title="Needs attention" sub="Oldest first">
          <ul className="space-y-2">
            {pendingQueue.map((u) => {
              const hasId = String(u.studentId || "").trim() !== "";
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onGo("users", "pending")}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-left transition hover:border-[#c9963f]/35 hover:bg-white/[0.06]"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-[#f4e6cd]"
                      style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
                    >
                      {/^https?:\/\//i.test(u.profilePhoto || "") ? (
                        <img src={u.profilePhoto} alt="" className="h-full w-full object-cover" />
                      ) : (
                        nameOf(u).charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{nameOf(u)}</span>
                      <span className="block text-xs text-white/40">
                        Waiting {waited(u.since, now) || "—"} ·{" "}
                        {hasId ? <span className="text-emerald-300/80">ID given</span> : <span className="text-red-300/80">No student ID</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[#d6bd97]">Review</span>
                  </button>
                </li>
              );
            })}
            {openReports > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => onGo("reports")}
                  className="flex w-full items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-2.5 text-left transition hover:bg-red-400/[0.1]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-400/30 bg-red-400/10 text-red-300">
                    <HiOutlineFlag className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-white">
                    {openReports} open report{openReports === 1 ? "" : "s"}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-red-300">Review</span>
                </button>
              </li>
            )}
            {pendingQueue.length === 0 && openReports === 0 && <Empty text="Nothing waiting. All caught up." />}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, sub, right, children }) {
  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white" style={inter}>{title}</h3>
          {sub && <p className="text-xs text-white/40">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Total({ color, label, value }) {
  return (
    <div>
      <p className="font-mono text-xl font-bold tabular-nums text-white">{value}</p>
      <p className="flex items-center justify-end gap-1.5 text-[11px] text-white/45">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </p>
    </div>
  );
}

function Empty({ text }) {
  return <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">{text}</p>;
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#d6bd97]/25 bg-[#1b160d]/95 px-3 py-2 text-xs shadow-[0_10px_30px_rgba(0,0,0,0.5)]" style={inter}>
      <p className="mb-1 font-semibold text-[#f4e6cd]">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-white/70">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-white">{p.value}</span>
        </p>
      ))}
    </div>
  );
}
