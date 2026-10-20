import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import {
  HiBookmark,
  HiOutlineArrowLeft,
  HiOutlineBookmark,
  HiOutlineExclamationTriangle,
  HiOutlineShoppingBag,
  HiOutlineWrenchScrewdriver,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";
import { toggleSave } from "../utils/saves";
import { timeAgo } from "../utils/activity";
import { serviceCategoryEmoji } from "../constants/serviceCategories";

const inter = { fontFamily: "'Inter', sans-serif" };

const formatKs = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);

const card =
  "relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

// What a saved item's card says about its current state.
// "gone" = removed or deleted: nothing to open any more.
const stateOf = (item) => {
  if (!item || item.status === "removed") return { kind: "gone", label: "No longer available" };
  if (item.status === "sold") return { kind: "dim", label: "Sold" };
  if (item.status === "paused") return { kind: "dim", label: "Paused" };
  return { kind: "live", label: "" };
};

// My Saved: every listing and service the student bookmarked, newest save
// first, in one grid. Uses the `saves` list rule (uid == me) from 12a.
export default function Saved() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [uid, setUid] = useState(null);
  const [rows, setRows] = useState([]); // { saveId, itemId, itemType, savedAt, item, owner }
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [popup, setPopup] = useState({ show: false, text: "", ok: true });
  const toast = (text, ok = true) => {
    setPopup({ show: true, text, ok });
    setTimeout(() => setPopup((p) => ({ ...p, show: false })), 2200);
  };

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 100);
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      setUid(user.uid);
      try {
        const savesSnap = await getDocs(
          query(collection(db, "saves"), where("uid", "==", user.uid))
        );
        const saves = savesSnap.docs
          .map((d) => ({
            saveId: d.id,
            itemId: d.data().itemId,
            itemType: d.data().itemType === "service" ? "service" : "listing",
            savedAt: d.data().createdAt?.toDate?.() ?? null,
          }))
          .sort((a, b) => (b.savedAt?.getTime() || 0) - (a.savedAt?.getTime() || 0));

        const items = await Promise.all(
          saves.map(async (s) => {
            const snap = await getDoc(
              doc(db, s.itemType === "listing" ? "listings" : "services", s.itemId)
            );
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
          })
        );

        const ownerIds = [
          ...new Set(items.filter(Boolean).map((it) => it.sellerId || it.providerId)),
        ];
        const owners = Object.fromEntries(
          await Promise.all(
            ownerIds.map(async (id) => {
              try {
                const p = await getDoc(doc(db, "publicProfiles", id));
                return [id, p.exists() ? p.data() : null];
              } catch {
                return [id, null];
              }
            })
          )
        );

        setRows(
          saves.map((s, i) => {
            const item = items[i];
            return { ...s, item, owner: item ? owners[item.sellerId || item.providerId] : null };
          })
        );
      } catch (err) {
        console.error("Saved load failed:", err);
        setLoadErr(true);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [navigate]);

  const handleUnsave = async (e, row) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uid || busyId) return;
    setBusyId(row.saveId);
    try {
      await toggleSave({ uid, itemId: row.itemId, itemType: row.itemType, currentlySaved: true });
      setRows((prev) => prev.filter((r) => r.saveId !== row.saveId));
      toast("Removed from saved.");
    } catch (err) {
      console.error("Unsave failed:", err);
      toast("Couldn't remove it. Try again.", false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0b07] text-white" style={inter}>
      <div className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${dashboardBg})` }} aria-hidden />
      <div className="absolute inset-0 bg-[#0d0b07]/85" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a120a]/45 via-[#0d0b07]/75 to-black/95" aria-hidden />
      <HiOutlineBookmark
        className="pointer-events-none absolute -right-16 top-24 hidden h-[24rem] w-[24rem] rotate-12 text-[#d6bd97]/[0.05] sm:block"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* ── Header ── */}
        <header
          className={`${card} mb-5 px-6 py-5 transition-all duration-700 ${
            show ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          }`}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg,transparent,rgba(214,189,151,0.5),transparent)" }}
          />
          <div className="relative z-10">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c9963f] transition-colors hover:text-[#d6bd97]"
            >
              <HiOutlineArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl" style={inter}>My Saved</h1>
              {!loading && !loadErr && (
                <span className="text-sm text-[#f4e6cd]/45">
                  {rows.length} {rows.length === 1 ? "item" : "items"}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[#f4e6cd]/55">Listings and services you bookmarked, newest first.</p>
          </div>
        </header>

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
            ))}
          </div>
        ) : loadErr ? (
          <div className={`${card} flex flex-col items-center px-4 py-14 text-center`}>
            <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
            <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load your saved items</p>
            <p className="mt-1 max-w-[260px] text-sm text-white/40">Check your connection and refresh the page.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className={`${card} flex flex-col items-center px-4 py-16 text-center`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
              <HiOutlineBookmark className="h-6 w-6 text-[#d6bd97]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white" style={inter}>Nothing saved yet</h3>
            <p className="mt-1 max-w-[300px] text-sm text-[#f4e6cd]/45">
              Tap the bookmark on any listing or service to keep it here.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <Link
                to="/marketplace"
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-sm font-bold uppercase tracking-[0.06em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5"
              >
                <HiOutlineShoppingBag className="h-4 w-4" /> Marketplace
              </Link>
              <Link
                to="/services"
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-semibold text-white/75 transition-all duration-200 hover:bg-white/[0.09] hover:text-white"
              >
                <HiOutlineWrenchScrewdriver className="h-4 w-4" /> Services
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((row, i) => (
              <SavedCard
                key={row.saveId}
                row={row}
                index={i}
                show={show}
                busy={busyId === row.saveId}
                onUnsave={handleUnsave}
              />
            ))}
          </div>
        )}
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
    </div>
  );
}

function SavedCard({ row, index, show, busy, onUnsave }) {
  const { item, owner, itemType } = row;
  const state = stateOf(item);
  const isListing = itemType === "listing";
  const photo = item?.photos && item.photos[0];
  const delay = Math.min(index, 11) * 35;
  const ownerName = owner?.name?.trim() || "Student";
  const to = `/${isListing ? "marketplace" : "services"}/${row.itemId}`;

  const body = (
    <>
      <div className="relative aspect-square overflow-hidden bg-[#090704]">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              state.kind === "live" ? "" : "grayscale"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/15">
            {isListing ? (
              <HiOutlineShoppingBag className="h-10 w-10" />
            ) : (
              <span className="text-5xl opacity-60" aria-hidden="true">{serviceCategoryEmoji(item?.category)}</span>
            )}
          </div>
        )}

        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#f4e6cd]/80 backdrop-blur-sm">
          {isListing ? "Listing" : "Service"}
        </span>

        {state.kind !== "live" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="rounded-full border border-white/20 bg-black/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#f4e6cd]">
              {state.label}
            </span>
          </div>
        )}

        {item && state.kind !== "gone" && (
          <span className="absolute bottom-2 left-2 rounded-full bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-2.5 py-1 text-xs font-bold text-[#f4e6cd] shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
            Ks {formatKs(item.price)}
          </span>
        )}

        <button
          type="button"
          onClick={(e) => onUnsave(e, row)}
          disabled={busy}
          aria-label="Remove from saved"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all duration-150 hover:scale-110 hover:bg-black/70 disabled:opacity-50"
        >
          <HiBookmark className="h-4 w-4 text-[#d6bd97]" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-3 py-2.5">
        <h3 className="truncate text-sm font-semibold text-white" style={inter}>
          {item?.title || "Deleted item"}
        </h3>
        <div className="mt-auto flex items-center gap-1.5">
          {item ? (
            <>
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-semibold text-[#f4e6cd]"
                style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
              >
                {/^https?:\/\//i.test(owner?.photo || "") ? (
                  <img src={owner.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  ownerName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="truncate text-xs text-[#f4e6cd]/50">{ownerName}</span>
            </>
          ) : (
            <span className="text-xs text-[#f4e6cd]/40">Removed by its owner</span>
          )}
          <span className="ml-auto shrink-0 text-[10px] text-[#f4e6cd]/35">
            Saved {timeAgo(row.savedAt)}
          </span>
        </div>
      </div>
    </>
  );

  const base = "group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300";
  const style = {
    opacity: show ? (state.kind === "live" ? 1 : 0.75) : 0,
    transform: show ? "translateY(0)" : "translateY(14px)",
    transition: `opacity .45s ease ${delay}ms, transform .45s ease ${delay}ms, border-color .2s, box-shadow .2s`,
  };

  // A removed item has no page to open, so its card is not a link.
  if (state.kind === "gone") {
    return (
      <article className={`${base} border-white/[0.06] bg-white/[0.02]`} style={style}>
        {body}
      </article>
    );
  }

  return (
    <Link
      to={to}
      className={`${base} border-white/[0.09] bg-white/[0.04] hover:-translate-y-1 hover:border-[#c9963f]/40 hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]`}
      style={style}
    >
      {body}
    </Link>
  );
}
