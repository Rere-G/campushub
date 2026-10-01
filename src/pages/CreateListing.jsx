import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { HiOutlineXMark, HiOutlineCheckCircle, HiOutlinePhoto, HiOutlineTag } from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";

const inter = { fontFamily: "'Inter', sans-serif" };

// --- Cloudinary unsigned upload config (these are NOT secrets; safe in client code) ---
const CLOUDINARY_CLOUD_NAME = "jrwzbtls";
const CLOUDINARY_LISTINGS_PRESET = "campushub_listings_unsigned";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 3;
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 600;

const CATEGORIES = [
  { key: "books", label: "📚 Books & Study" },
  { key: "electronics", label: "💻 Electronics" },
  { key: "clothing", label: "👕 Clothing & Accessories" },
  { key: "dorm", label: "🪑 Dorm & Living" },
  { key: "gaming", label: "🎮 Gaming & Hobbies" },
  { key: "services", label: "🛠️ Services" },
];

const formatKs = (n) => {
  const num = Number(n);
  if (!num || num <= 0) return null;
  return new Intl.NumberFormat("en-US").format(num);
};

export default function CreateListing() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [photos, setPhotos] = useState([null, null, null]); // slot values: null | { url, uploading }
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [popup, setPopup] = useState({ show: false, text: "", ok: true });

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  const showPopup = (text, ok = true, ms = 2600) => {
    setPopup({ show: true, text, ok });
    setTimeout(() => setPopup((p) => ({ ...p, show: false })), ms);
  };

  const filledPhotoCount = photos.filter((p) => p && p.url).length;
  const anyUploading = photos.some((p) => p && p.uploading);
  const formattedPrice = formatKs(price);

  const handlePhotoChange = async (slotIndex, e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showPopup("Please choose an image file.", false);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showPopup("That image is over 5 MB — pick a smaller one.", false);
      return;
    }

    setPhotos((prev) => {
      const next = [...prev];
      next[slotIndex] = { url: null, uploading: true };
      return next;
    });

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", CLOUDINARY_LISTINGS_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.secure_url) {
        throw new Error((json && json.error && json.error.message) || "Upload failed");
      }
      setPhotos((prev) => {
        const next = [...prev];
        next[slotIndex] = { url: json.secure_url, uploading: false };
        return next;
      });
    } catch (err) {
      console.error("Listing photo upload failed:", err);
      setPhotos((prev) => {
        const next = [...prev];
        next[slotIndex] = null;
        return next;
      });
      showPopup("Upload failed — please try that photo again.", false);
    }
  };

  const removePhoto = (slotIndex) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPrice("");
    setCategory("");
    setPhotos([null, null, null]);
    setPosted(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const priceNum = Number(price);
    const photoUrls = photos.filter((p) => p && p.url).map((p) => p.url);

    if (!trimmedTitle) return showPopup("Give your listing a title.", false);
    if (!trimmedDescription) return showPopup("Add a short description.", false);
    if (!price || !(priceNum > 0)) return showPopup("Enter a price greater than 0.", false);
    if (!category) return showPopup("Pick a category.", false);
    if (photoUrls.length < 1) return showPopup("Add at least one photo.", false);
    if (photoUrls.length > MAX_PHOTOS) return showPopup(`Only ${MAX_PHOTOS} photos allowed.`, false);

    setSubmitting(true);
    try {
      await addDoc(collection(db, "listings"), {
        sellerId: user.uid,
        title: trimmedTitle,
        description: trimmedDescription,
        price: priceNum,
        category,
        photos: photoUrls,
        status: "active",
        createdAt: serverTimestamp(),
      });
      setPosted(true);
    } catch (err) {
      console.error("Couldn't post listing:", err);
      showPopup("Couldn't post your listing — please try again.", false);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-[#d6bd97]/25 bg-[#090704]/70 px-4 py-3 text-[#f4e6cd] placeholder:text-white/30 outline-none transition focus:border-[#c9963f] focus:shadow-[0_0_0_4px_rgba(201,150,63,0.18)]";
  const labelClass = "mb-2 block text-sm font-medium text-[#f4e6cd]/75";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0b07] px-4 py-8 sm:px-6" style={inter}>
      {/* Background: same photo + overlay stack as Dashboard/Profile/Admin */}
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${dashboardBg})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-[#0d0b07]/85" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1a120a]/45 via-[#0d0b07]/75 to-black/95" aria-hidden />

      {/* Ambient warm glow, same bronze→amber language as the CTA button's own shadow */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-[#c9963f]/25 via-[#8f774b]/10 to-transparent blur-3xl"
        aria-hidden
      />

      {/* Large faint tag watermark — grounds the page in "you're pricing & listing an item",
          reusing the same icon Admin already uses to represent listings/posts */}
      <HiOutlineTag
        className="pointer-events-none absolute -right-16 top-20 hidden h-[26rem] w-[26rem] -rotate-12 text-[#d6bd97]/[0.05] sm:block"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <Link
          to="/dashboard"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#c9963f] transition-colors hover:text-[#d6bd97]"
        >
          ← Back to dashboard
        </Link>

        <div
          className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-700 sm:p-8"
          style={{
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(16px)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
            style={{ background: "linear-gradient(90deg,#8f774b,#c9963f)" }}
          />

          {posted ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 shadow-[0_8px_26px_rgba(16,185,129,0.25)]">
                <HiOutlineCheckCircle className="h-7 w-7 text-emerald-300" />
              </div>
              <h1 className="mt-4 text-2xl font-bold text-white" style={inter}>
                Listing posted!
              </h1>
              <p className="mt-2 text-sm text-[#f4e6cd]/55">Your item is live on CampusHub.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={resetForm}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-6 text-sm font-bold uppercase tracking-[0.08em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a]"
                >
                  Post another
                </button>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-semibold text-white/75 transition-all duration-200 hover:bg-white/[0.09] hover:text-white"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white sm:text-3xl" style={inter}>
                Post an item
              </h1>
              <p className="mt-1 text-sm text-[#f4e6cd]/55">
                A clear title, honest description, and real photos sell faster.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className={labelClass}>Title</label>
                    <span className="mb-2 text-[11px] text-[#f4e6cd]/30">{title.length}/{TITLE_MAX}</span>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. TI-84 Plus calculator"
                    className={inputClass}
                    maxLength={TITLE_MAX}
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className={labelClass}>Description</label>
                    <span className="mb-2 text-[11px] text-[#f4e6cd]/30">{description.length}/{DESCRIPTION_MAX}</span>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Condition, how long you've had it, why you're selling..."
                    rows={4}
                    className={inputClass}
                    maxLength={DESCRIPTION_MAX}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Price</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#d6bd97]/70">
                        Ks
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                    <p className="mt-1.5 h-4 text-[11px] text-[#f4e6cd]/40">
                      {formattedPrice ? `= Ks ${formattedPrice}` : " "}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={`${inputClass} appearance-none pr-10`}
                      >
                        <option value="" disabled className="bg-[#1e211e]">
                          Select…
                        </option>
                        {CATEGORIES.map((c) => (
                          <option key={c.key} value={c.key} className="bg-[#1e211e]">
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        viewBox="0 0 16 16"
                        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d6bd97]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="mt-1.5 h-4 text-[11px] text-[#f4e6cd]/40">&nbsp;</p>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Photos{" "}
                    <span className="text-[#f4e6cd]/40">
                      ({filledPhotoCount}/{MAX_PHOTOS}, at least 1 required)
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((slotIndex) => (
                      <PhotoSlot
                        key={slotIndex}
                        slotIndex={slotIndex}
                        slot={photos[slotIndex]}
                        onChange={handlePhotoChange}
                        onRemove={removePhoto}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || anyUploading}
                  className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] text-sm font-bold uppercase tracking-[0.1em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Posting…" : anyUploading ? "Uploading photo…" : "Post listing"}
                </button>
              </form>
            </>
          )}
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
    </div>
  );
}

function PhotoSlot({ slotIndex, slot, onChange, onRemove }) {
  const inputId = `listing-photo-${slotIndex}`;

  if (slot && slot.uploading) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-[#d6bd97]/20 bg-[#090704]/70">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-[#c9963f]" />
      </div>
    );
  }

  if (slot && slot.url) {
    return (
      <div className="group relative aspect-square overflow-hidden rounded-2xl border border-[#d6bd97]/25 transition-transform duration-200 hover:-translate-y-0.5">
        <img src={slot.url} alt="" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => onRemove(slotIndex)}
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-red-500/80"
          aria-label="Remove photo"
        >
          <HiOutlineXMark className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <label
      htmlFor={inputId}
      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#d6bd97]/25 bg-[#090704]/40 text-[#f4e6cd]/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c9963f]/50 hover:text-[#d6bd97]"
    >
      <HiOutlinePhoto className="h-5 w-5" />
      <span className="text-[10px] font-medium uppercase tracking-wide">Photo {slotIndex + 1}</span>
      <input id={inputId} type="file" accept="image/*" className="hidden" onChange={(e) => onChange(slotIndex, e)} />
    </label>
  );
}
