import { Link } from "react-router-dom";
import { HiBookmark, HiOutlineBookmark, HiOutlineEye, HiOutlineListBullet, HiOutlineSquares2X2 } from "react-icons/hi2";
import CategorySelect from "./CategorySelect";

// Stage 18a-1: shared browse tools for Marketplace and Services —
// results count, Sort menu, Grid/List switch, "New" badge and list rows.

const SORTS_NEWEST = [{ key: "newest", label: "Newest first" }];
const SORTS_ALL = [
  ...SORTS_NEWEST,
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
];

// "12 listings · Sort [Newest first ▾] · [▦][☰]"
export function ResultsBar({ count, noun, sort, setSort, priceSortable, view, setView }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-[#f4e6cd]/50" aria-live="polite">
        <span className="font-semibold text-[#f4e6cd]/80">{count}</span> {count === 1 ? noun : `${noun}s`}
      </p>
      <div className="flex items-center gap-2">
        <div className="w-[176px]" title={priceSortable ? undefined : "Pick Ks or $ to sort by price"}>
          <CategorySelect
            label="Sort"
            value={sort}
            onChange={setSort}
            options={priceSortable ? SORTS_ALL : SORTS_NEWEST}
            inputClass="h-9 w-full rounded-xl border border-[#d6bd97]/20 bg-[#090704]/70 px-3 text-xs font-medium text-[#f4e6cd] outline-none transition focus-visible:border-[#c9963f]"
          />
        </div>
        <div className="flex rounded-xl border border-[#d6bd97]/20 bg-[#090704]/70 p-0.5" role="group" aria-label="Layout">
          {[
            { key: "grid", label: "Grid view", Icon: HiOutlineSquares2X2 },
            { key: "list", label: "List view", Icon: HiOutlineListBullet },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={view === key}
              title={label}
              onClick={() => setView(key)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                view === key ? "bg-[#c9963f]/20 text-[#f4e6cd]" : "text-[#f4e6cd]/45 hover:bg-[#c9963f]/10 hover:text-[#d6bd97]"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NewBadge({ className = "" }) {
  return (
    <span
      className={`rounded-full border border-[#c9963f]/50 bg-[#0d0b07]/80 whitespace-nowrap px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#e8c88f] backdrop-blur-sm ${className}`}
    >
      Just posted
    </span>
  );
}

function Tag({ children }) {
  return (
    <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#f4e6cd]/60">
      {children}
    </span>
  );
}

// One compact row in List view.
export function PostRow({ to, photo, fallback, title, price, tags = [], person, time, isNew, saved, onToggleSave, saveLabel, onQuickView }) {
  const initial = (person?.name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2.5 pr-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c9963f]/40 hover:bg-white/[0.05] motion-reduce:hover:translate-y-0 sm:gap-4"
    >
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-[#090704] sm:h-20 sm:w-20">
        {photo ? (
          <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          fallback
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>{title}</h3>
          {isNew && <NewBadge className="shrink-0" />}
        </div>
        <p className="mt-0.5 text-sm font-bold text-[#d6bd97]">{price}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-[#f4e6cd]/45">
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full text-[8px] font-semibold text-[#f4e6cd]"
              style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
            >
              {person?.photo ? <img src={person.photo} alt="" className="h-full w-full object-cover" /> : initial}
            </span>
            <span className="truncate">{person?.name || "Student"}</span>
            <span className="shrink-0 text-[#f4e6cd]/30">· {time}</span>
          </span>
        </div>
      </div>

      {onQuickView && (
        <button
          type="button"
          onClick={onQuickView}
          aria-label={`Quick view: ${title}`}
          title="Quick view"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-all hover:border-[#c9963f]/40 hover:text-[#d6bd97]"
        >
          <HiOutlineEye className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleSave}
        aria-label={saved ? "Remove from saved" : saveLabel}
        aria-pressed={saved}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-all hover:border-[#c9963f]/40 hover:text-[#d6bd97]"
      >
        {saved ? <HiBookmark className="h-4 w-4 text-[#d6bd97]" /> : <HiOutlineBookmark className="h-4 w-4" />}
      </button>
    </Link>
  );
}
