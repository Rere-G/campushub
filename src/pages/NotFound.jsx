import { Link } from "react-router-dom";
import mascot from "../assets/TS.webp";
import { usePageTitle } from "../utils/pageTitle";

const inter = { fontFamily: "'Inter', sans-serif" };

// Stage 17b: any URL that isn't a CampusHub page.
export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0d0b07] px-4 py-12 text-white" style={inter}>
      <div className="w-full max-w-md text-center">
        <img
          src={mascot}
          alt=""
          aria-hidden="true"
          className="animate-mascot-bob mx-auto w-[140px] opacity-90 drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
          style={{ imageRendering: "pixelated" }}
        />
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.4em] text-[#d6bd97]/60">Error 404</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl" style={inter}>Page not found</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/50">
          This page doesn't exist or has moved. Check the link, or head back to somewhere familiar.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            to="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-6 text-sm font-bold text-[#f4e6cd] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(143,119,75,0.45)]"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-semibold text-white/80 transition hover:bg-white/[0.09]"
          >
            CampusHub home
          </Link>
        </div>
      </div>
    </main>
  );
}
