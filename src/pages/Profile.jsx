import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import dashboardBg from "../assets/dashboard-bg.jpg";

const inter = { fontFamily: "'Inter', sans-serif" };

// Wide range: last 10 years (alumni) .. +7 (current students' expected year)
const GRAD_YEARS = (() => {
  const y = new Date().getFullYear();
  const arr = [];
  for (let yr = y - 10; yr <= y + 7; yr++) arr.push(String(yr));
  return arr;
})();

const isFilled = (v) => v != null && String(v).trim() !== "";
const pad2 = (n) => String(Number(n) || 0).padStart(2, "0");

const formatMemberSince = (createdAt) => {
  try {
    let d;
    if (createdAt && typeof createdAt.toDate === "function") d = createdAt.toDate();
    else if (typeof createdAt === "string") d = new Date(createdAt);
    else return "—";
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
};

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ show: false, text: "", ok: true });

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    bio: "",
    university: "",
    department: "",
    graduationYear: "",
    studentId: "",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate("/login");
        return;
      }
      setUser(currentUser);
      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        const data = snap.exists() ? snap.data() : null;
        setProfile(data);
        if (data) {
          setForm({
            fullName: data.fullName || "",
            username: data.username || "",
            bio: data.bio || "",
            university: data.university || "",
            department: data.department || "",
            graduationYear: data.graduationYear || "",
            studentId: data.studentId || "",
          });
        }
      } catch (err) {
        setPopup({ show: true, text: "Couldn't load your profile. Refresh and try again.", ok: false });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const completionPct = useMemo(() => {
    const fields = [form.fullName, form.bio, form.department, form.graduationYear, form.university, profile?.profilePhoto];
    return Math.round((fields.filter(isFilled).length / 6) * 100);
  }, [form, profile]);

  const showPopup = (text, ok = true, ms = 2200) => {
    setPopup({ show: true, text, ok });
    setTimeout(() => setPopup((p) => ({ ...p, show: false })), ms);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const completionFields = [form.fullName, form.bio, form.department, form.graduationYear, form.university, profile?.profilePhoto];
      const allFilled = completionFields.every(isFilled);

      // Partial update — never sends approved/role, so the security rules stay satisfied.
      await updateDoc(doc(db, "users", user.uid), {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        bio: form.bio.trim(),
        university: form.university.trim(),
        department: form.department.trim(),
        graduationYear: form.graduationYear,
        studentId: form.studentId.trim(),
        profileCompleted: allFilled,
      });

      setProfile((p) => ({
        ...(p || {}),
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        bio: form.bio.trim(),
        university: form.university.trim(),
        department: form.department.trim(),
        graduationYear: form.graduationYear,
        studentId: form.studentId.trim(),
        profileCompleted: allFilled,
      }));

      showPopup(allFilled ? "Profile saved — you're all set!" : "Profile saved.");
    } catch (err) {
      showPopup("Couldn't save. Check your connection and try again.", false, 2800);
    } finally {
      setSaving(false);
    }
  };

  const displayName = (form.fullName || form.username || user?.email || "Your profile").trim();
  const initial = (form.fullName || form.username || user?.email || "?").trim().charAt(0).toUpperCase() || "?";
  const photo = profile?.profilePhoto || "";
  const photoIsUrl = /^https?:\/\//i.test(photo);
  const verified = profile?.verificationStatus === "verified";

  const inputClass =
    "w-full rounded-2xl border border-[#d6bd97]/25 bg-[#090704]/70 px-4 py-3 text-[#f4e6cd] placeholder:text-white/30 outline-none transition focus:border-[#c9963f] focus:shadow-[0_0_0_4px_rgba(201,150,63,0.18)]";
  const labelClass = "mb-2 block text-sm font-medium text-[#f4e6cd]/75";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0b07] px-4 py-8 sm:px-6" style={inter}>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${dashboardBg})` }} aria-hidden />
      <div className="absolute inset-0 bg-[#0d0b07]/85" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1a120a]/45 via-[#0d0b07]/70 to-black/95" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <Link to="/dashboard" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#c9963f] transition-colors hover:text-[#d6bd97]">
          ← Back to dashboard
        </Link>

        {loading ? (
          <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.05] p-8 text-white/60 backdrop-blur-xl">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-[#c9963f]" />
            Loading your profile…
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_1fr]">
            {/* IDENTITY CARD */}
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <div className="h-[3px] bg-gradient-to-r from-[#8f774b] to-[#c9963f]" />
              <div className="p-5 text-center sm:p-6">
                {photoIsUrl ? (
                  <img src={photo} alt="Your profile" className="mx-auto h-[92px] w-[92px] rounded-full object-cover ring-2 ring-[#c9963f]/40" />
                ) : (
                  <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-full bg-gradient-to-br from-[#8f774b] to-[#c9963f] text-3xl font-semibold text-[#f4e6cd] shadow-[0_8px_26px_rgba(143,119,75,0.45)]">
                    {initial}
                  </div>
                )}
                <p className="mt-2.5 text-[11px] text-[#f4e6cd]/40">Photo upload coming in the next update</p>
                <h2 className="mt-3 text-xl font-semibold text-[#f4e6cd]" style={inter}>{displayName}</h2>
                <p className="mt-0.5 text-[13px] text-[#f4e6cd]/60">
                  {form.username ? `@${form.username}` : "@student"} · {profile?.role === "admin" ? "Admin" : "Student"}
                </p>
                <div className="mt-3">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${verified ? "bg-green-500/15 text-green-300" : "bg-[#c9963f]/15 text-[#d6bd97]"}`}>
                    {verified ? "Verified" : "Not verified"}
                  </span>
                </div>

                <div className="my-5 h-px bg-white/10" />

                <div className="flex flex-col gap-3.5 text-left">
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="text-[#f4e6cd]/50">Email</span>
                    <span className="truncate text-right font-medium text-[#f4e6cd]">{user?.email || profile?.email || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="text-[#f4e6cd]/50">University</span>
                    <span className="text-right font-medium text-[#f4e6cd]">{form.university || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="text-[#f4e6cd]/50">Department</span>
                    <span className="text-right font-medium text-[#f4e6cd]">{form.department || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="text-[#f4e6cd]/50">Member since</span>
                    <span className="text-right font-medium text-[#f4e6cd]">{formatMemberSince(profile?.createdAt)}</span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[["Listings", profile?.listingsCount], ["Services", profile?.servicesCount], ["Saved", profile?.savedCount]].map(([label, n]) => (
                    <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/25 px-1.5 py-2.5">
                      <div className="text-lg font-semibold text-[#d6bd97]">{pad2(n)}</div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[#f4e6cd]/45">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 text-left">
                  <div className="flex justify-between text-xs text-[#f4e6cd]/65">
                    <span>Profile completion</span>
                    <span className="font-semibold text-[#d6bd97]">{completionPct}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#8f774b] to-[#c9963f] transition-[width] duration-500" style={{ width: `${completionPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* EDIT FORM */}
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <div className="h-[3px] bg-[#d6bd97]/80" />
              <div className="p-6 sm:p-7">
                <h1 className="text-2xl font-semibold text-[#f4e6cd] sm:text-3xl" style={inter}>Edit profile</h1>
                <p className="mt-1.5 mb-6 text-sm text-[#f4e6cd]/60">A complete, real profile helps other students trust you when buying and selling on campus.</p>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass} htmlFor="fullName">Full name</label>
                    <input id="fullName" name="fullName" value={form.fullName} onChange={onChange} placeholder="e.g. Amara Okafor" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="username">Username</label>
                    <input id="username" name="username" value={form.username} onChange={onChange} placeholder="e.g. amara" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="bio">Bio</label>
                    <textarea id="bio" name="bio" value={form.bio} onChange={onChange} rows={3} placeholder="A sentence or two about you and what you buy or sell." className={`${inputClass} resize-none`} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="university">University</label>
                      <input id="university" name="university" value={form.university} onChange={onChange} placeholder="e.g. University of Lagos" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="department">Department</label>
                      <input id="department" name="department" value={form.department} onChange={onChange} placeholder="e.g. Computer Science" className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="graduationYear">Graduation year (or expected)</label>
                      <div className="relative">
                        <select id="graduationYear" name="graduationYear" value={form.graduationYear} onChange={onChange} className={`${inputClass} appearance-none pr-10`}>
                          <option value="" className="bg-[#1e211e]">Select year</option>
                          {GRAD_YEARS.map((y) => (
                            <option key={y} value={y} className="bg-[#1e211e]">{y}</option>
                          ))}
                        </select>
                        <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d6bd97]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#f4e6cd]/40">The year you graduated, or expect to.</p>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="studentId">Student ID</label>
                      <input id="studentId" name="studentId" value={form.studentId} onChange={onChange} placeholder="e.g. 20/1234" className={inputClass} />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="group relative mt-7 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-6 py-3.5 text-base font-semibold uppercase tracking-[0.12em] text-[#f4e6cd] transition-all duration-300 hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a] hover:shadow-[0_10px_30px_rgba(143,119,75,0.45)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  <span className="relative z-10">{saving ? "Saving…" : "Save profile"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {popup.show && (
        <div className={`fixed top-6 right-6 z-50 w-72 max-w-[78vw] rounded-xl p-4 font-semibold text-white shadow-lg animate-slide-in ${popup.ok ? "bg-gradient-to-r from-[#8f774b] to-[#c9963f]" : "bg-gradient-to-r from-red-500 to-rose-500"}`}>
          {popup.text}
        </div>
      )}

      <style>
        {`
          @keyframes slide-in {
            0% { transform: translateX(120%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }
          .animate-slide-in { animation: slide-in 0.45s ease-out forwards; }
          @media (prefers-reduced-motion: reduce) {
            .animate-slide-in { animation: none; }
          }
        `}
      </style>
    </div>
  );
}
