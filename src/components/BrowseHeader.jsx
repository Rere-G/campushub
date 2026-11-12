import { Link } from "react-router-dom";
import { HiOutlineArrowLeft, HiOutlinePlusCircle } from "react-icons/hi2";

const inter = { fontFamily: "'Inter', sans-serif" };

// Header for the Marketplace and Services browse pages: an icon badge,
// title, a row of live stats worked out from the posts already loaded
// (no extra Firestore reads), and the main "post" button.
// stats: [{ label, value }]; value is a number, shown as "–" while loading.
export default function BrowseHeader({ show, icon: Icon, eyebrow, title, subtitle, stats, loading, cta }) {
  return (
    <header
      className={`relative mb-5 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-700 ${
        show ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
      }`}
    >
      {/* Decoration: gold top edge, a warm glow on the right and a faint dot grid. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg,transparent,rgba(214,189,151,0.6),transparent)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(201,150,63,0.22),transparent_65%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-[0.35] sm:block"
        style={{
          backgroundImage: "radial-gradient(rgba(214,189,151,0.18) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage: "linear-gradient(to left, #000, transparent)",
          WebkitMaskImage: "linear-gradient(to left, #000, transparent)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 px-5 py-5 sm:px-7 sm:py-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c9963f] transition-colors hover:text-[#d6bd97]"
        >
          <HiOutlineArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#d6bd97]/30 shadow-[0_10px_30px_rgba(143,119,75,0.35)] sm:h-16 sm:w-16"
              style={{ background: "linear-gradient(135deg,#3a2a14 0%,#8f774b 55%,#c9963f 100%)" }}
              aria-hidden="true"
            >
              <Icon className="h-7 w-7 text-[#f4e6cd] sm:h-8 sm:w-8" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#d6bd97]/60">{eyebrow}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl" style={inter}>
                {title}
              </h1>
              <p className="mt-1 text-sm text-[#f4e6cd]/55">{subtitle}</p>
            </div>
          </div>

          <Link
            to={cta.to}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-sm font-bold uppercase tracking-[0.06em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a] hover:shadow-[0_12px_28px_rgba(143,119,75,0.45)]"
          >
            <HiOutlinePlusCircle className="h-4 w-4" /> {cta.label}
          </Link>
        </div>

        {/* Live stats */}
        <dl className="mt-5 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex min-w-0 flex-col-reverse rounded-xl border border-white/[0.07] bg-[#090704]/45 px-3 py-2 sm:min-w-[120px] sm:px-4"
            >
              <dt className="truncate text-[11px] text-[#f4e6cd]/45">{s.label}</dt>
              <dd className="text-lg font-bold leading-tight text-[#f4e6cd] sm:text-xl">
                {loading ? <span className="text-[#f4e6cd]/25">–</span> : s.value.toLocaleString("en-US")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
