import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  HiOutlineArrowLeft,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineTag,
  HiOutlineBookmark,
  HiBookmark,
  HiOutlineInformationCircle,
  HiOutlineExclamationTriangle,
  HiOutlineShoppingBag,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";
import { categoryLabel } from "../constants/categories";
import { saveIdFor, toggleSave } from "../utils/saves";

const inter = { fontFamily: "'Inter', sans-serif" };

const formatKs = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);

// Defined at module scope (not inside ListingDetail) on purpose: a component
// defined inside another component's body gets a new function identity every
// render, which makes React treat it as a different component type and
// remount the whole subtree — visible here as the photo flashing on every
// arrow click, since activePhoto changing would re-run the parent and
// recreate Shell each time.
function Shell({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0b07] text-white" style={inter}>
      <div className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${dashboardBg})` }} aria-hidden />
      <div className="absolute inset-0 bg-[#0d0b07]/85" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a120a]/45 via-[#0d0b07]/75 to-black/95" aria-hidden />
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-[#c9963f]/25 via-[#8f774b]/10 to-transparent blur-3xl"
        aria-hidden
      />
      {/* Same watermark device as CreateListing — this page is also "one priced item" */}
      <HiOutlineTag
        className="pointer-events-none absolute -right-16 top-20 hidden h-[26rem] w-[26rem] -rotate-12 text-[#d6bd97]/[0.05] sm:block"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [uid, setUid] = useState(null);

  const [listing, setListing] = useState(null);
  const [seller, setSeller] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  const [popup, setPopup] = useState({ show: false, text: "", ok: true });
  const toast = (text, ok = true) => {
    setPopup({ show: true, text, ok });
    setTimeout(() => setPopup((p) => ({ ...p, show: false })), 2200);
  };

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 80);
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      setUid(user.uid);
      try {
        const listingSnap = await getDoc(doc(db, "listings", id));
        if (!listingSnap.exists()) {
          setNotFound(true);
          return;
        }
        const data = { id: listingSnap.id, ...listingSnap.data() };
        setListing(data);

        const [sellerSnap, saveSnap] = await Promise.all([
          getDoc(doc(db, "publicProfiles", data.sellerId)),
          getDoc(doc(db, "saves", saveIdFor(user.uid, id))),
        ]);
        setSeller(sellerSnap.exists() ? sellerSnap.data() : null);
        setSaved(saveSnap.exists());
      } catch (err) {
        console.error("Listing load failed:", err);
        setLoadErr(true);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [id, navigate]);

  const handleToggleSave = async () => {
    if (!uid || saving) return;
    setSaving(true);
    const was = saved;
    setSaved(!was);
    try {
      await toggleSave({ uid, itemId: id, itemType: "listing", currentlySaved: was });
    } catch (err) {
      console.error("Save toggle failed:", err);
      setSaved(was);
      toast("Couldn't update saved — try again.", false);
    } finally {
      setSaving(false);
    }
  };

  const card =
    "relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

  if (loading) {
    return (
      <Shell>
        <div className="mb-5 h-4 w-32 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-[24px] bg-white/[0.04]" />
          <div className="space-y-3">
            <div className="h-7 w-2/3 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          </div>
        </div>
      </Shell>
    );
  }

  if (notFound) {
    return (
      <Shell>
        <div className={`${card} flex flex-col items-center px-4 py-16 text-center`}>
          <HiOutlineShoppingBag className="h-6 w-6 text-[#f4e6cd]/40" />
          <h1 className="mt-4 text-lg font-semibold text-white" style={inter}>Listing not found</h1>
          <p className="mt-1 max-w-[280px] text-sm text-[#f4e6cd]/45">
            It may have been removed, or the link isn't quite right.
          </p>
          <Link
            to="/marketplace"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-sm font-bold uppercase tracking-[0.06em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5"
          >
            Back to Marketplace
          </Link>
        </div>
      </Shell>
    );
  }

  if (loadErr) {
    return (
      <Shell>
        <div className={`${card} flex flex-col items-center px-4 py-16 text-center`}>
          <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
          <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load this listing</p>
          <p className="mt-1 max-w-[260px] text-sm text-white/40">Check your connection and refresh the page.</p>
        </div>
      </Shell>
    );
  }

  const photos = listing.photos && listing.photos.length ? listing.photos : [];
  const prevPhoto = () => setActivePhoto((i) => (i - 1 + photos.length) % photos.length);
  const nextPhoto = () => setActivePhoto((i) => (i + 1) % photos.length);
  const statusBadge =
    listing.status === "sold"
      ? { text: "Sold", cls: "text-[#fca5a5]", bg: "rgba(248,113,113,0.16)" }
      : listing.status === "removed"
      ? { text: "Removed", cls: "text-[#f4e6cd]/60", bg: "rgba(255,255,255,0.08)" }
      : null;
  const isOwnListing = uid === listing.sellerId;

  return (
    <Shell>
      <Link
        to="/marketplace"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#c9963f] transition-colors hover:text-[#d6bd97]"
      >
        <HiOutlineArrowLeft className="h-4 w-4" /> Back to Marketplace
      </Link>

      <div
        className="grid grid-cols-1 gap-5 transition-all duration-700 md:grid-cols-2"
        style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(16px)" }}
      >
        {/* ── Photo gallery ── */}
        <div>
          <div className={`${card} aspect-square`}>
            {photos.length ? (
              <img src={photos[activePhoto]} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/15">
                <HiOutlineShoppingBag className="h-16 w-16" />
              </div>
            )}
            {statusBadge && (
              <span
                className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadge.cls}`}
                style={{ background: statusBadge.bg, backdropFilter: "blur(6px)" }}
              >
                {statusBadge.text}
              </span>
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevPhoto}
                  aria-label="Previous photo"
                  className="absolute left-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all duration-150 hover:scale-110 hover:bg-black/70"
                >
                  <HiOutlineChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={nextPhoto}
                  aria-label="Next photo"
                  className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all duration-150 hover:scale-110 hover:bg-black/70"
                >
                  <HiOutlineChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
                  {activePhoto + 1} / {photos.length}
                </span>
              </>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 flex gap-2.5">
              {photos.map((p, i) => (
                <button
                  key={p + i}
                  onClick={() => setActivePhoto(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                    i === activePhoto ? "border-[#c9963f]" : "border-white/10 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Details ── */}
        <div className="flex flex-col gap-4">
          <div className={`${card} p-5 sm:p-6`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg,#8f774b,#c9963f)" }} />
            <span className="inline-block rounded-full bg-[#c9963f]/15 px-2.5 py-1 text-[11px] font-medium text-[#d6bd97]">
              {categoryLabel(listing.category)}
            </span>
            <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl" style={inter}>{listing.title}</h1>
            <p className="mt-1.5 text-2xl font-bold text-[#d6bd97]">Ks {formatKs(listing.price)}</p>

            <button
              type="button"
              onClick={handleToggleSave}
              disabled={saving}
              aria-pressed={saved}
              className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold uppercase tracking-[0.06em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6 ${
                saved
                  ? "border border-[#c9963f]/50 bg-[#c9963f]/15 text-[#d6bd97]"
                  : "border border-white/15 bg-white/[0.06] text-white/80 hover:bg-white/[0.1]"
              }`}
            >
              {saved ? <HiBookmark className="h-4 w-4" /> : <HiOutlineBookmark className="h-4 w-4" />}
              {saved ? "Saved" : "Save"}
            </button>
          </div>

          <div className={`${card} p-5 sm:p-6`}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#f4e6cd]/45" style={inter}>Seller</h2>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-[#f4e6cd]"
                style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
              >
                {seller?.photo ? (
                  <img src={seller.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  (seller?.name || "?").trim().charAt(0).toUpperCase() || "?"
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {seller?.name || "Student"}
                  {isOwnListing && <span className="ml-1.5 text-xs font-normal text-[#f4e6cd]/40">(you)</span>}
                </p>
                <p className="text-xs text-[#f4e6cd]/45">CampusHub member</p>
              </div>
            </div>

            {!isOwnListing && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                <HiOutlineInformationCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#d6bd97]/70" />
                <p className="text-xs leading-relaxed text-[#f4e6cd]/55">
                  CampusHub doesn't have in-app messaging yet. Find {seller?.name ? seller.name.split(" ")[0] : "the seller"}{" "}
                  on campus to ask questions and arrange pickup.
                </p>
              </div>
            )}
          </div>

          <div className={`${card} flex-1 p-5 sm:p-6`}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#f4e6cd]/45" style={inter}>Description</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#f4e6cd]/80">{listing.description}</p>
          </div>
        </div>
      </div>

      {popup.show && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-[calc(16px+env(safe-area-inset-top,0px))] z-[70] w-72 max-w-[78vw] rounded-xl p-4 text-sm font-semibold text-white shadow-lg animate-cl-slide-in ${
            popup.ok ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f]" : "bg-gradient-to-r from-red-500 to-rose-500"
          }`}
        >
          {popup.text}
        </div>
      )}

      <style>{`
        @keyframes cl-slide-in {
          0% { transform: translateX(120%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-cl-slide-in { animation: cl-slide-in 0.35s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .animate-cl-slide-in { animation: none; }
        }
      `}</style>
    </Shell>
  );
}
