import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, increment, updateDoc } from "firebase/firestore";
import {
  HiOutlineArrowLeft,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineWrenchScrewdriver,
  HiOutlineBookmark,
  HiBookmark,
  HiOutlineInformationCircle,
  HiOutlineExclamationTriangle,
  HiOutlinePause,
  HiOutlinePlay,
  HiOutlineTrash,
} from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";
import { serviceCategoryEmoji, serviceCategoryLabel } from "../constants/serviceCategories";
import { saveIdFor, toggleSave } from "../utils/saves";
import Comments from "../components/Comments";
import ReportButton from "../components/ReportButton";

const inter = { fontFamily: "'Inter', sans-serif" };

const formatKs = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);

// Defined at module scope (not inside ServiceDetail) on purpose: a component
// defined inside another component's body is a new type every render, which
// remounts its whole subtree (the photo flashed on every arrow click in
// ListingDetail before the same fix).
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
      <HiOutlineWrenchScrewdriver
        className="pointer-events-none absolute -right-16 top-20 hidden h-[26rem] w-[26rem] -rotate-12 text-[#d6bd97]/[0.05] sm:block"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

const card =
  "relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [uid, setUid] = useState(null);

  const [service, setService] = useState(null);
  const [provider, setProvider] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  const [changingStatus, setChangingStatus] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

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
        const serviceSnap = await getDoc(doc(db, "services", id));
        if (!serviceSnap.exists()) {
          setNotFound(true);
          return;
        }
        const data = { id: serviceSnap.id, ...serviceSnap.data() };
        // A removed service is gone for everyone except the provider.
        if (data.status === "removed" && data.providerId !== user.uid) {
          setNotFound(true);
          return;
        }
        setService(data);

        const [providerSnap, saveSnap] = await Promise.all([
          getDoc(doc(db, "publicProfiles", data.providerId)),
          getDoc(doc(db, "saves", saveIdFor(user.uid, id))),
        ]);
        setProvider(providerSnap.exists() ? providerSnap.data() : null);
        setSaved(saveSnap.exists());
      } catch (err) {
        console.error("Service load failed:", err);
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
      await toggleSave({ uid, itemId: id, itemType: "service", currentlySaved: was });
    } catch (err) {
      console.error("Save toggle failed:", err);
      setSaved(was);
      toast("Couldn't update saved — try again.", false);
    } finally {
      setSaving(false);
    }
  };

  // Provider-only: moves the service between active / paused / removed.
  // firestore.rules lets the provider make exactly these three transitions.
  const changeStatus = async (next) => {
    if (changingStatus) return;
    setChangingStatus(true);
    try {
      await updateDoc(doc(db, "services", id), { status: next });
      setService((s) => ({ ...s, status: next }));
      setConfirmRemove(false);
      if (next === "removed") {
        // Keep the Dashboard "Services" tile in step. The removal already
        // succeeded, so a failure here is only logged.
        try {
          await updateDoc(doc(db, "users", uid), { servicesCount: increment(-1) });
        } catch (countErr) {
          console.error("Couldn't update servicesCount:", countErr);
        }
        toast("Service removed.");
      } else if (next === "paused") {
        toast("Service paused — hidden from browse.");
      } else {
        toast("Service is live again.");
      }
    } catch (err) {
      console.error("Status change failed:", err);
      toast("Couldn't update the service — try again.", false);
    } finally {
      setChangingStatus(false);
    }
  };

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
          <HiOutlineWrenchScrewdriver className="h-6 w-6 text-[#f4e6cd]/40" />
          <h1 className="mt-4 text-lg font-semibold text-white" style={inter}>Service not found</h1>
          <p className="mt-1 max-w-[280px] text-sm text-[#f4e6cd]/45">
            It may have been removed, or the link isn't quite right.
          </p>
          <Link
            to="/services"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-sm font-bold uppercase tracking-[0.06em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5"
          >
            Back to Services
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
          <p className="mt-3 text-sm font-semibold text-white/70">Couldn't load this service</p>
          <p className="mt-1 max-w-[260px] text-sm text-white/40">Check your connection and refresh the page.</p>
        </div>
      </Shell>
    );
  }

  const photos = service.photos && service.photos.length ? service.photos : [];
  const prevPhoto = () => setActivePhoto((i) => (i - 1 + photos.length) % photos.length);
  const nextPhoto = () => setActivePhoto((i) => (i + 1) % photos.length);
  const statusBadge =
    service.status === "paused"
      ? { text: "Paused", cls: "text-[#fcd34d]", bg: "rgba(251,191,36,0.16)" }
      : service.status === "removed"
      ? { text: "Removed", cls: "text-[#f4e6cd]/60", bg: "rgba(255,255,255,0.08)" }
      : null;
  const isOwn = uid === service.providerId;
  const providerFirst = provider?.name ? provider.name.split(" ")[0] : "the provider";

  return (
    <Shell>
      <Link
        to="/services"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#c9963f] transition-colors hover:text-[#d6bd97]"
      >
        <HiOutlineArrowLeft className="h-4 w-4" /> Back to Services
      </Link>

      <div
        className="grid grid-cols-1 gap-5 transition-all duration-700 md:grid-cols-2 md:grid-rows-[auto_1fr]"
        style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(16px)" }}
      >
        {/* ── Media: photo gallery, or the category emoji when there are no photos ── */}
        <div className="md:col-start-1 md:row-start-1">
          <div className={`${card} aspect-square`}>
            {photos.length ? (
              <img src={photos[activePhoto]} alt={service.title} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: "linear-gradient(135deg,#3a2a14 0%,#8f774b 55%,#c9963f 100%)" }}
              >
                <span className="select-none text-[8rem] leading-none drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]" aria-hidden="true">
                  {serviceCategoryEmoji(service.category)}
                </span>
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
        <div className="flex flex-col gap-4 md:col-start-2 md:row-span-2 md:row-start-1">
          <div className={`${card} p-5 sm:p-6`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg,#8f774b,#c9963f)" }} />
            <span className="inline-block rounded-full bg-[#c9963f]/15 px-2.5 py-1 text-[11px] font-medium text-[#d6bd97]">
              {serviceCategoryLabel(service.category)}
            </span>
            <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl" style={inter}>{service.title}</h1>
            <p className="mt-1.5 text-2xl font-bold text-[#d6bd97]">Ks {formatKs(service.price)}</p>

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
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#f4e6cd]/45" style={inter}>Provider</h2>
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-semibold text-[#f4e6cd] ring-2 ring-[#d6bd97]/25"
                style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
              >
                {provider?.photo ? (
                  <img src={provider.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  (provider?.name || "?").trim().charAt(0).toUpperCase() || "?"
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">
                  {provider?.name || "Student"}
                  {isOwn && <span className="ml-1.5 text-xs font-normal text-[#f4e6cd]/40">(you)</span>}
                </p>
                <p className="text-xs text-[#f4e6cd]/45">CampusHub member</p>
              </div>
            </div>

            {!isOwn && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                <HiOutlineInformationCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#d6bd97]/70" />
                <p className="text-xs leading-relaxed text-[#f4e6cd]/55">
                  CampusHub doesn't have private messages yet. Ask in the comments, or find {providerFirst} on
                  campus to agree on details.
                </p>
              </div>
            )}

            {!isOwn && service.status !== "removed" && (
              <ReportButton
                uid={uid}
                targetType="service"
                itemType="service"
                itemId={id}
                targetOwnerId={service.providerId}
                onReported={(msg) => toast(msg)}
              />
            )}
          </div>

          {/* ── Provider-only controls ── */}
          {isOwn && service.status !== "removed" && (
            <div className={`${card} p-5 sm:p-6`}>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[#f4e6cd]/45" style={inter}>Manage your service</h2>
              <p className="mb-4 text-xs leading-relaxed text-[#f4e6cd]/50">
                {service.status === "paused"
                  ? "Paused: hidden from the Services page. Resume it whenever you're available again."
                  : "Live: visible to everyone on the Services page. Pause it if you're too busy to take requests."}
              </p>

              {confirmRemove ? (
                <div className="rounded-xl border border-red-400/25 bg-red-500/[0.06] p-3.5">
                  <p className="text-sm text-[#f4e6cd]/80">Remove this service? It will disappear for everyone.</p>
                  <div className="mt-3 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => changeStatus("removed")}
                      disabled={changingStatus}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-4 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <HiOutlineTrash className="h-4 w-4" /> Yes, remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      disabled={changingStatus}
                      className="inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/75 transition-all hover:bg-white/[0.09] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {service.status === "paused" ? (
                    <button
                      type="button"
                      onClick={() => changeStatus("active")}
                      disabled={changingStatus}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-4 text-sm font-semibold text-[#f4e6cd] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <HiOutlinePlay className="h-4 w-4" /> Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => changeStatus("paused")}
                      disabled={changingStatus}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white/85 transition-all hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <HiOutlinePause className="h-4 w-4" /> Pause
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    disabled={changingStatus}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/[0.06] px-4 text-sm font-semibold text-red-200/90 transition-all hover:bg-red-500/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <HiOutlineTrash className="h-4 w-4" /> Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {isOwn && service.status === "removed" && (
            <div className={`${card} p-5 sm:p-6`}>
              <p className="text-sm text-[#f4e6cd]/70">This service was removed and is no longer visible to anyone else.</p>
              <Link
                to="/services"
                className="mt-4 inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/75 transition-all hover:bg-white/[0.09] hover:text-white"
              >
                Back to Services
              </Link>
            </div>
          )}

          <div className={`${card} flex-1 p-5 sm:p-6`}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#f4e6cd]/45" style={inter}>About this service</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#f4e6cd]/80">{service.description}</p>
          </div>
        </div>

        <Comments
          itemType="service"
          itemId={id}
          ownerId={service.providerId}
          uid={uid}
          closed={service.status === "removed"}
        />
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
