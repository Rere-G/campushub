import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import mascotGif from "../assets/TS.gif";
import bgVideo from "../assets/bg-video.mp4";

const friendlyAuthError = (err, provider = "This") => {
  switch (err?.code) {
    case "auth/operation-not-allowed":
      return `${provider} sign-in isn’t available yet — try another option for now.`;
    case "auth/account-exists-with-different-credential":
      return "You already have an account with this email. Sign in with your password instead.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    default:
      return err?.message || "Something went wrong. Please try again.";
  }
};

export default function Login() {
  const navigate = useNavigate();

  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null); // "submit" | "google" | "apple" | null

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(timer);
  }, []);

  const ensureUserDoc = async (user) => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        username: user.displayName || "",
        email: user.email || "",
        approved: false,
        profileCompleted: false,
        verificationStatus: "incomplete",
        fullName: "",
        university: "",
        studentId: "",
        department: "",
        graduationYear: "",
        bio: "",
        profilePhoto: user.photoURL || "",
        listingsCount: 0,
        servicesCount: 0,
        savedCount: 0,
        role: "student",
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy("submit");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage("Login successful. Redirecting...");

      setTimeout(() => {
        navigate("/dashboard");
      }, 1200);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setBusy("google");
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserDoc(user);
      navigate("/dashboard");
    } catch (err) {
      const m = friendlyAuthError(err, "Google");
      if (m) setMessage(m);
    } finally {
      setBusy(null);
    }
  };

  const handleApple = async () => {
    setBusy("apple");
    try {
      const { user } = await signInWithPopup(auth, new OAuthProvider("apple.com"));
      await ensureUserDoc(user);
      navigate("/dashboard");
    } catch (err) {
      const m = friendlyAuthError(err, "Apple");
      if (m) setMessage(m);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 py-8 sm:px-6 lg:px-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* VIDEO BACKGROUND */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover opacity-90"
      >
        <source src={bgVideo} type="video/mp4" />
      </video>

      {/* DARK SCRIM */}
      <div className="absolute inset-0 bg-black/25" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          {/* hero side */}
          <div
            className={`order-2 flex flex-col items-center text-center transition-all duration-1000 ease-out ${show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
              }`}
          >
            <h1
              className="text-5xl font-semibold uppercase tracking-[0.18em] text-[#f4e6cd] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-6xl xl:text-7xl"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              CampusHub
            </h1>

            <p className="mt-4 max-w-md text-sm text-white/75 sm:text-base">
              Sign in and enter your campus marketplace universe.
            </p>
          </div>

          {/* mascot — grounded to the section, not the hero column */}
          <div
            className={`order-3 relative mx-auto mt-8 w-[240px] transition-all duration-1000 delay-200 ease-out sm:w-[300px] md:w-[360px] xl:w-[430px] lg:absolute lg:right-[6%] lg:bottom-[12vh] lg:mt-0 lg:mx-0 ${show ? "translate-y-0 opacity-100 scale-100" : "translate-y-12 opacity-0 scale-95"
              }`}
          >
            <img
              src={mascotGif}
              alt="CampusHub mascot"
              className="animate-mascot-bob relative z-10 w-full drop-shadow-[0_24px_55px_rgba(0,0,0,0.55)]"
            />
            <div
              aria-hidden
              className="animate-shadow-pulse pointer-events-none absolute bottom-[6px] left-1/2 h-[16px] w-[55%] -translate-x-1/2 rounded-[50%]"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 45%, transparent 72%)",
              }}
            />
          </div>

          {/* login card */}
          <div className="order-1 mx-auto w-full max-w-lg">
            <div
              className={`relative rounded-[28px] border border-white/15 bg-white/10 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl transition-all duration-700 ease-out sm:p-8 md:p-10 ${show ? "translate-y-0 opacity-100 scale-100" : "translate-y-10 opacity-0 scale-95"
                }`}
            >
              <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/10" />

              <div className="relative z-10">
                <p className="mb-2 text-sm font-medium uppercase tracking-[0.3em] text-white/60">
                  Welcome back
                </p>

                <h2
                  className="mb-8 text-3xl font-semibold text-white sm:text-4xl"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Login
                </h2>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/45 outline-none transition-all duration-300 hover:bg-white/15 focus:border-fuchsia-400 focus:bg-white/15 focus:shadow-[0_0_0_4px_rgba(192,132,252,0.18)]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 pr-12 text-white placeholder:text-white/45 outline-none transition-all duration-300 hover:bg-white/15 focus:border-fuchsia-400 focus:bg-white/15 focus:shadow-[0_0_0_4px_rgba(192,132,252,0.18)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white/80"
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M3 3l18 18" strokeLinecap="round" />
                            <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.9 17.9 0 0 1-3.2 4.2M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={!!busy}
                      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-6 py-3.5 text-base font-semibold uppercase tracking-[0.12em] text-[#f4e6cd] transition-all duration-300 hover:-translate-y-1 hover:from-[#9c8352] hover:to-[#d6a24a] hover:shadow-[0_10px_30px_rgba(143,119,75,0.45)] active:translate-y-0 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      <span className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                      </span>
                      <span className="relative z-10">{busy === "submit" ? "Signing in…" : "Sign In"}</span>
                    </button>
                  </div>
                </form>

                <div className="my-5 flex items-center gap-3 text-white/40">
                  <span className="h-px flex-1 bg-white/15" />
                  <span className="text-xs uppercase tracking-[0.2em]">or</span>
                  <span className="h-px flex-1 bg-white/15" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={!!busy}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white/95 px-4 py-3 font-semibold text-[#1e211e] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                  </svg>
                  {busy === "google" ? "Signing in…" : "Continue with Google"}
                </button>

                <button
                  type="button"
                  onClick={handleApple}
                  disabled={!!busy}
                  className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-4 py-3 font-semibold text-white transition hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg viewBox="0 0 384 512" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                  </svg>
                  {busy === "apple" ? "Signing in…" : "Continue with Apple"}
                </button>

                <div className="mt-6 space-y-3 text-sm sm:text-base">
                  <button
                    type="button"
                    className="text-white/70 transition-colors duration-200 hover:text-[#d6bd97]"
                  >
                    Forgot password?
                  </button>

                  <p className="text-white/70">
                    Don’t have an account?{" "}
                    <Link
                      to="/signup"
                      className="font-semibold text-[#c9963f] transition-colors duration-200 hover:text-[#d6bd97]"
                    >
                      Create one
                    </Link>
                  </p>
                </div>

                {message && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/90 backdrop-blur-md">
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
