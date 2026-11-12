import { Component } from "react";
import { Link, useLocation } from "react-router-dom";
import { HiOutlineArrowPath, HiOutlineExclamationTriangle } from "react-icons/hi2";

const inter = { fontFamily: "'Inter', sans-serif" };

// After a deploy, an open tab may ask for a page file that no longer exists.
const isChunkError = (e) =>
  /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|Loading chunk/i.test(
    String(e?.message || e)
  );
const RELOAD_KEY = "ch-chunk-reload";

// Stage 17b: shows a calm "Something went wrong" screen instead of a blank
// page when a page crashes. Resets when you navigate to another page.
class Boundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
    // A missing page file after a deploy: reload once to fetch the new version.
    if (isChunkError(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* storage blocked: the Reload button still works */
      }
    }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const updated = isChunkError(this.state.error);
    return (
      <div
        role="alert"
        className={`flex items-center justify-center bg-[#0d0b07] px-4 py-16 text-white ${this.props.fullScreen ? "min-h-[100dvh]" : "min-h-[70vh] flex-1"}`}
        style={inter}
      >
        <div className="w-full max-w-sm rounded-[24px] border border-white/[0.09] bg-white/[0.04] p-7 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#c9963f]/30 bg-[#c9963f]/10">
            {updated ? (
              <HiOutlineArrowPath className="h-6 w-6 text-[#d6bd97]" />
            ) : (
              <HiOutlineExclamationTriangle className="h-6 w-6 text-[#d6bd97]" />
            )}
          </div>
          <h1 className="mt-4 text-xl font-bold text-white" style={inter}>
            {updated ? "CampusHub was updated" : "Something went wrong"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/50">
            {updated
              ? "A newer version is available. Reload to get it."
              : "This page hit an error. Your data is safe. Try reloading, or go back to your dashboard."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-sm font-semibold text-[#f4e6cd] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(143,119,75,0.4)]"
            >
              <HiOutlineArrowPath className="h-4 w-4" /> Reload
            </button>
            {!updated && (
              <Link
                to={this.props.homeTo || "/dashboard"}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.09]"
              >
                {this.props.homeTo === "/" ? "Go home" : "Go to Dashboard"}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// Wraps a part of the app; the screen clears itself when the URL changes.
export default function ErrorBoundary({ children, fullScreen = false, homeTo }) {
  const { pathname } = useLocation();
  return (
    <Boundary resetKey={pathname} fullScreen={fullScreen} homeTo={homeTo}>
      {children}
    </Boundary>
  );
}
