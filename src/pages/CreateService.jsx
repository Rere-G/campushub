import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { HiOutlineCheckCircle, HiOutlineWrenchScrewdriver } from "react-icons/hi2";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";
import { SERVICE_CATEGORIES } from "../constants/serviceCategories";
import CategorySelect from "../components/CategorySelect";
import PhotoSlot from "../components/PhotoSlot";

const inter = { fontFamily: "'Inter', sans-serif" };

// --- Cloudinary unsigned upload config (these are NOT secrets; safe in client code) ---
const CLOUDINARY_CLOUD_NAME = "jrwzbtls";
// Reuses the listings preset on purpose: same unsigned upload folder, no new
// Cloudinary setup needed.
const CLOUDINARY_LISTINGS_PRESET = "campushub_listings_unsigned";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 3;
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 600;

const formatKs = (n) => {
  const num = Number(n);
  if (!num || num <= 0) return null;
  return new Intl.NumberFormat("en-US").format(num);
};

export default function CreateService() {
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
      console.error("Service photo upload failed:", err);
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

    if (!trimmedTitle) return showPopup("Give your service a title.", false);
    if (!trimmedDescription) return showPopup("Add a short description.", false);
    if (!price || !(priceNum > 0)) return showPopup("Enter a price greater than 0.", false);
    if (!category) return showPopup("Pick a category.", false);
    if (photoUrls.length > MAX_PHOTOS) return showPopup(`Only ${MAX_PHOTOS} photos allowed.`, false);

    setSubmitting(true);
    try {
      await addDoc(collection(db, "services"), {
        providerId: user.uid,
        title: trimmedTitle,
        description: trimmedDescription,
        price: priceNum,
        category,
        photos: photoUrls,
        status: "active",
        createdAt: serverTimestamp(),
      });
      // Keep the Dashboard "Services" tile in step. The post already
      // succeeded, so a failure here is logged, never shown as a failed post.
      try {
        await updateDoc(doc(db, "users", user.uid), { servicesCount: increment(1) });
      } catch (countErr) {
        console.error("Couldn't update servicesCount:", countErr);
      }
      setPosted(true);
    } catch (err) {
      console.error("Couldn't post service:", err);
      showPopup("Couldn't post your service — please try again.", false);
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

      {/* Large faint watermark — the wrench-and-screwdriver is the same icon the
          Dashboard uses for Services, so the page reads as "offering a skill" */}
      <HiOutlineWrenchScrewdriver
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
                Service posted!
              </h1>
              <p className="mt-2 text-sm text-[#f4e6cd]/55">Your service is live on CampusHub.</p>
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
                Offer a service
              </h1>
              <p className="mt-1 text-sm text-[#f4e6cd]/55">
                Say what you offer, who it helps, and what the price covers.
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
                    placeholder="e.g. Calculus tutoring, 1 hour"
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
                    placeholder="What's included, your experience, when you're available..."
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
                    <CategorySelect value={category} onChange={setCategory} options={SERVICE_CATEGORIES} inputClass={inputClass} />
                    <p className="mt-1.5 h-4 text-[11px] text-[#f4e6cd]/40">&nbsp;</p>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Photos{" "}
                    <span className="text-[#f4e6cd]/40">
                      ({filledPhotoCount}/{MAX_PHOTOS}, optional)
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
                  {submitting ? "Posting…" : anyUploading ? "Uploading photo…" : "Post service"}
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
