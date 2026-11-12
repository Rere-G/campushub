import { useCallback, useEffect, useMemo, useState } from "react";
import { usePageTitle } from "../utils/pageTitle";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
  HiOutlineEye,
  HiOutlineShoppingBag,
  HiOutlineMagnifyingGlass,
  HiOutlinePlusCircle,
  HiOutlineBookmark,
  HiBookmark,
  HiOutlineExclamationTriangle,
  HiOutlineXMark,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";
import { CATEGORIES } from "../constants/categories";
import { saveIdFor, toggleSave } from "../utils/saves";
import PriceFilter from "../components/PriceFilter";
import BrowseHeader from "../components/BrowseHeader";
import { NewBadge, PostRow, ResultsBar } from "../components/BrowseControls";
import QuickView from "../components/QuickView";
import { isNewPost, sortPosts, useBrowseView } from "../utils/browse";
import { conditionLabel, currencyOf, formatPostPrice } from "../utils/postDetails";

const inter = { fontFamily: "'Inter', sans-serif" };


const timeAgo = (date) => {
  if (!date) return "";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const TABS = [{ key: "all", label: "All" }, ...CATEGORIES];

export default function Marketplace() {
  usePageTitle("Marketplace");
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [uid, setUid] = useState(null);

  const [listings, setListings] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [quickId, setQuickId] = useState(null);
  const quickItem = quickId ? listings.find((x) => x.id === quickId) : null;
  const openQuick = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickId(id);
  };
  const closeQuick = useCallback(() => setQuickId(null), []);
  const [view, setView] = useBrowseView("marketplace");

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
        const [listingsSnap, profilesSnap] = await Promise.all([
          getDocs(collection(db, "listings")),
          getDocs(collection(db, "publicProfiles")),
        ]);
        const activeListings = listingsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((l) => l.status === "active");
        setListings(activeListings);

        const pMap = {};
        profilesSnap.docs.forEach((d) => {
          pMap[d.id] = d.data();
        });
        setProfiles(pMap);

        // The saves collection's rules check the document id, not a data
        // field, so "which of these are saved?" is a direct getDoc per
        // listing by its deterministic id — never a query. See
        // firestore.rules' own comment on match /saves/{saveId}.
        const saveSnaps = await Promise.all(
          activeListings.map((l) => getDoc(doc(db, "saves", saveIdFor(user.uid, l.id))))
        );
        const saved = new Set();
        saveSnaps.forEach((snap, i) => {
          if (snap.exists()) saved.add(activeListings[i].id);
        });
        setSavedIds(saved);
      } catch (err) {
        console.error("Marketplace load failed:", err);
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

  const hasActiveFilters =
    tab !== "all" ||
    search.trim() !== "" ||
    currencyFilter !== "all" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    sort !== "newest";

  const clearFilters = () => {
    setTab("all");
    setSearch("");
    setCurrencyFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
  };

  // Ks and $ can't be compared, so price sorting needs one currency picked.
  const pickCurrency = (c) => {
    setCurrencyFilter(c);
    if (c === "all") setSort("newest");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minPrice !== "" ? Number(minPrice) : null;
    const max = maxPrice !== "" ? Number(maxPrice) : null;
    const list = listings
      .filter((l) => tab === "all" || l.category === tab)
      .filter((l) => !q || l.title.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q))
      .filter((l) => currencyFilter === "all" || currencyOf(l) === currencyFilter)
      .filter((l) => min === null || l.price >= min)
      .filter((l) => max === null || l.price <= max);
    return sortPosts(list, sort);
  }, [listings, tab, search, currencyFilter, minPrice, maxPrice, sort]);

  // Header stats, from the listings already loaded.
  const postedToday = useMemo(() => listings.filter(isNewPost).length, [listings]);

  const handleToggleSave = async (e, listingId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uid) return;
    const was = savedIds.has(listingId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (was) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    try {
      await toggleSave({ uid, itemId: listingId, itemType: "listing", currentlySaved: was });
    } catch (err) {
      console.error("Save toggle failed:", err);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (was) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
      toast("Couldn't update saved — try again.", false);
    }
  };

  const card =
    "relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0b07] text-white" style={inter}>
      {/* Background: same photo + overlay stack used across Dashboard/Admin/Profile/CreateListing */}
      <div className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${dashboardBg})` }} aria-hidden />
      <div className="absolute inset-0 bg-[#0d0b07]/85" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a120a]/45 via-[#0d0b07]/75 to-black/95" aria-hidden />
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-[#c9963f]/20 via-[#8f774b]/10 to-transparent blur-3xl"
        aria-hidden
      />
      {/* Large faint watermark — this is the browse page, so a shopping bag grounds it,
          same device CreateListing uses with a tag for "pricing an item" */}
      <HiOutlineShoppingBag
        className="pointer-events-none absolute -right-20 top-24 hidden h-[26rem] w-[26rem] rotate-12 text-[#d6bd97]/[0.05] sm:block"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* ── Header ── */}
        <BrowseHeader
          show={show}
          icon={HiOutlineShoppingBag}
          eyebrow="Campus marketplace"
          title="Marketplace"
          subtitle="Buy and sell with fellow students on campus."
          loading={loading}
          stats={[
            { label: "Listings for sale", value: listings.length },
            { label: "Posted today", value: postedToday },
            { label: "Saved by you", value: savedIds.size },
          ]}
          cta={{ to: "/marketplace/new", label: "Post an item" }}
        />

        {/* ── Filters ── */}
        <section
          className={`${card} mb-5 p-4 transition-all duration-700 delay-100 sm:p-5 ${
            show ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <div className="relative z-10 flex flex-col gap-3.5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d6bd97]/50" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search listings…"
                  className="w-full rounded-2xl border border-[#d6bd97]/20 bg-[#090704]/70 py-3 pl-11 pr-4 text-sm text-[#f4e6cd] placeholder:text-white/30 outline-none transition focus:border-[#c9963f] focus:shadow-[0_0_0_4px_rgba(201,150,63,0.18)]"
                />
              </div>
              <PriceFilter
                currency={currencyFilter}
                setCurrency={pickCurrency}
                minPrice={minPrice}
                setMinPrice={setMinPrice}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963f]/60 ${
                      active
                        ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-[#f4e6cd]"
                        : "border border-white/10 bg-white/[0.04] text-[#f4e6cd]/70 hover:border-[#c9963f]/40 hover:text-[#f4e6cd]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium text-[#f4e6cd]/50 transition-colors hover:text-[#f4e6cd]"
                >
                  <HiOutlineXMark className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Results ── */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
            ))}
          </div>
        ) : loadErr ? (
          <div className={`${card} flex flex-col items-center px-4 py-14 text-center`}>
            <HiOutlineExclamationTriangle className="h-6 w-6 text-red-300/70" />
            <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load listings</p>
            <p className="mt-1 max-w-[260px] text-sm text-white/40">Check your connection and refresh the page.</p>
          </div>
        ) : listings.length === 0 ? (
          <div className={`${card} flex flex-col items-center px-4 py-16 text-center`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
              <HiOutlineShoppingBag className="h-6 w-6 text-[#d6bd97]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white" style={inter}>No listings yet</h3>
            <p className="mt-1 max-w-[280px] text-sm text-[#f4e6cd]/45">Be the first to post something for sale.</p>
            <Link
              to="/marketplace/new"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-sm font-bold uppercase tracking-[0.06em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5"
            >
              <HiOutlinePlusCircle className="h-4 w-4" /> Post an item
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${card} flex flex-col items-center px-4 py-16 text-center`}>
            <HiOutlineMagnifyingGlass className="h-6 w-6 text-[#f4e6cd]/40" />
            <h3 className="mt-4 text-lg font-semibold text-white" style={inter}>No matches</h3>
            <p className="mt-1 max-w-[280px] text-sm text-[#f4e6cd]/45">Try a different search or widen your filters.</p>
            <button
              onClick={clearFilters}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-semibold text-white/75 transition-all duration-200 hover:bg-white/[0.09] hover:text-white"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <ResultsBar
              count={filtered.length}
              noun="listing"
              sort={sort}
              setSort={setSort}
              priceSortable={currencyFilter !== "all"}
              view={view}
              setView={setView}
            />
            {view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((listing, i) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  seller={profiles[listing.sellerId]}
                  saved={savedIds.has(listing.id)}
                  onToggleSave={handleToggleSave}
                  onQuickView={openQuick}
                  index={i}
                  show={show}
                />
              ))}
            </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((listing) => (
                <PostRow
                  key={listing.id}
                  to={`/marketplace/${listing.id}`}
                  photo={listing.photos?.[0]}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-white/15">
                      <HiOutlineShoppingBag className="h-7 w-7" />
                    </div>
                  }
                  title={listing.title}
                  price={formatPostPrice(listing)}
                  tags={[conditionLabel(listing.condition), listing.negotiable ? "Negotiable" : ""].filter(Boolean)}
                  person={profiles[listing.sellerId]}
                  time={timeAgo(listing.createdAt?.toDate?.())}
                  isNew={isNewPost(listing)}
                  saved={savedIds.has(listing.id)}
                  onToggleSave={(e) => handleToggleSave(e, listing.id)}
                  onQuickView={(e) => openQuick(e, listing.id)}
                  saveLabel="Save listing"
                />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {quickItem && (
        <QuickView
          item={quickItem}
          kind="listing"
          person={profiles[quickItem.sellerId]}
          uid={uid}
          saved={savedIds.has(quickItem.id)}
          onToggleSave={(e) => handleToggleSave(e, quickItem.id)}
          time={timeAgo(quickItem.createdAt?.toDate?.())}
          onClose={closeQuick}
        />
      )}

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

function ListingCard({ listing, seller, saved, onToggleSave, index, show, onQuickView }) {
  const photo = listing.photos && listing.photos[0];
  const delay = Math.min(index, 11) * 35;

  return (
    <Link
      to={`/marketplace/${listing.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.04] transition-all duration-300 hover:-translate-y-1 hover:border-[#c9963f]/40 hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(14px)",
        transition: `opacity .45s ease ${delay}ms, transform .45s ease ${delay}ms, border-color .2s, box-shadow .2s`,
      }}
    >
      <div className="relative aspect-square overflow-hidden bg-[#090704]">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/15">
            <HiOutlineShoppingBag className="h-10 w-10" />
          </div>
        )}

        {isNewPost(listing) && <NewBadge className="absolute left-2 top-2" />}

        <span className="absolute bottom-2 left-2 rounded-full bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-2.5 py-1 text-xs font-bold text-[#f4e6cd] shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
          {formatPostPrice(listing)}
        </span>

        <button
          type="button"
          onClick={(e) => onToggleSave(e, listing.id)}
          aria-label={saved ? "Remove from saved" : "Save listing"}
          aria-pressed={saved}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all duration-150 hover:scale-110 hover:bg-black/70"
        >
          {saved ? <HiBookmark className="h-4 w-4 text-[#d6bd97]" /> : <HiOutlineBookmark className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={(e) => onQuickView(e, listing.id)}
          aria-label={`Quick view: ${listing.title}`}
          title="Quick view"
          className="absolute right-2 top-12 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur-sm transition-all duration-150 hover:scale-110 hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <HiOutlineEye className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-3 py-2.5">
        <h3 className="truncate text-sm font-semibold text-white" style={inter}>{listing.title}</h3>
        {(listing.condition || listing.negotiable) && (
          <div className="flex flex-wrap gap-1">
            {listing.condition && <Tag>{conditionLabel(listing.condition)}</Tag>}
            {listing.negotiable && <Tag>Negotiable</Tag>}
          </div>
        )}
        <div className="mt-auto flex items-center gap-1.5">
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-semibold text-[#f4e6cd]"
            style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
          >
            {seller?.photo ? (
              <img src={seller.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              (seller?.name || "?").trim().charAt(0).toUpperCase() || "?"
            )}
          </div>
          <span className="truncate text-xs text-[#f4e6cd]/50">{seller?.name || "Student"}</span>
          <span className="ml-auto shrink-0 text-[10px] text-[#f4e6cd]/35">{timeAgo(listing.createdAt?.toDate?.())}</span>
        </div>
      </div>
    </Link>
  );
}

function Tag({ children }) {
  return (
    <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#f4e6cd]/60">
      {children}
    </span>
  );
}
