import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  HiBookmark,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineBookmark,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineShoppingBag,
  HiOutlineXMark,
} from "react-icons/hi2";
import PostFacts from "./PostFacts";
import MessageButton from "./MessageButton";
import { categoryLabel } from "../constants/categories";
import { serviceCategoryEmoji, serviceCategoryLabel } from "../constants/serviceCategories";

const inter = { fontFamily: "'Inter', sans-serif" };

// Stage 18a-2: a quick look at a listing or service without leaving the
// browse page. Popup on desktop, bottom sheet on phones. Uses only data the
// page already loaded, so opening it costs no database reads.
export default function QuickView({ item, kind, person, uid, saved, onToggleSave, time, onClose }) {
  const isListing = kind === "listing";
  const photos = (item.photos || []).filter(Boolean);
  const [i, setI] = useState(0);
  const closeRef = useRef(null);
  const ownerId = isListing ? item.sellerId : item.providerId;
  const isOwn = uid && ownerId === uid;
  const fullPage = `/${isListing ? "marketplace" : "services"}/${item.id}`;

  // Esc closes; arrows flip photos; page behind doesn't scroll; focus returns after.
  useEffect(() => {
    const before = document.activeElement;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && photos.length > 1) setI((n) => (n + 1) % photos.length);
      if (e.key === "ArrowLeft" && photos.length > 1) setI((n) => (n - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (before instanceof HTMLElement) before.focus();
    };
  }, [onClose, photos.length]);

  const initial = (person?.name || "?").trim().charAt(0).toUpperCase() || "?";

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={inter}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qv-title"
        className="ch-scroll relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-[28px] border border-white/[0.1] bg-[#16120c] text-white shadow-[0_30px_80px_rgba(0,0,0,0.65)] animate-[qv-up_.28s_ease-out] motion-reduce:animate-none sm:max-w-3xl sm:flex-row sm:overflow-hidden sm:rounded-[28px]"
      >
        {/* phone grab handle */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white/80 backdrop-blur-sm transition hover:bg-black/75 hover:text-white"
        >
          <HiOutlineXMark className="h-5 w-5" />
        </button>

        {/* ── Photos ── */}
        <div className="relative mx-3 mt-2 aspect-[4/3] shrink-0 sm:aspect-square overflow-hidden rounded-2xl bg-[#090704] sm:m-0 sm:w-[46%] sm:rounded-none">
          {photos.length ? (
            <img src={photos[i]} alt={`${item.title}, photo ${i + 1} of ${photos.length}`} className="h-full w-full object-cover" />
          ) : isListing ? (
            <div className="flex h-full w-full items-center justify-center text-white/15">
              <HiOutlineShoppingBag className="h-14 w-14" />
            </div>
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-7xl"
              style={{ background: "linear-gradient(135deg,#3a2a14 0%,#8f774b 55%,#c9963f 100%)" }}
              aria-hidden="true"
            >
              {serviceCategoryEmoji(item.category)}
            </div>
          )}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setI((n) => (n - 1 + photos.length) % photos.length)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75"
              >
                <HiOutlineChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setI((n) => (n + 1) % photos.length)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75"
              >
                <HiOutlineChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {photos.map((_, n) => (
                  <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-[#c9963f]" : "w-1.5 bg-white/40"}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Details ── */}
        <div className="flex min-w-0 flex-1 flex-col p-5 sm:overflow-y-auto sm:p-7">
          <span className="w-fit rounded-full bg-[#c9963f]/15 px-2.5 py-1 text-[11px] font-medium text-[#d6bd97]">
            {isListing ? categoryLabel(item.category) : serviceCategoryLabel(item.category)}
          </span>
          <h2 id="qv-title" className="mt-3 pr-8 text-xl font-bold leading-snug text-white sm:text-2xl" style={inter}>
            {item.title}
          </h2>

          <PostFacts post={item} isListing={isListing} />

          {item.description && (
            <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-[#f4e6cd]/70">{item.description}</p>
          )}

          <div className="mt-5 flex items-center gap-3 border-t border-white/[0.07] pt-4">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-[#f4e6cd]"
              style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
            >
              {person?.photo ? <img src={person.photo} alt="" className="h-full w-full object-cover" /> : initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {person?.name || "Student"}
                {isOwn && <span className="ml-1.5 text-xs font-normal text-white/40">(you)</span>}
              </p>
              <p className="text-xs text-white/40">
                {isListing ? "Seller" : "Provider"} · posted {time}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:mt-auto sm:pt-5">
            {!isOwn && (
              <MessageButton
                uid={uid}
                item={{ id: item.id, title: item.title, ownerId }}
                itemType={kind}
                ownerName={person?.name}
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onToggleSave}
                aria-pressed={saved}
                className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all ${
                  saved
                    ? "border border-[#c9963f]/50 bg-[#c9963f]/15 text-[#d6bd97]"
                    : "border border-white/12 bg-white/[0.05] text-white/80 hover:border-[#c9963f]/40 hover:text-[#d6bd97]"
                }`}
              >
                {saved ? <HiBookmark className="h-4 w-4" /> : <HiOutlineBookmark className="h-4 w-4" />}
                {saved ? "Saved" : "Save"}
              </button>
              <Link
                to={fullPage}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] text-sm font-semibold text-white/80 transition-all hover:border-[#c9963f]/40 hover:text-[#d6bd97]"
              >
                Open full page <HiOutlineArrowTopRightOnSquare className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
