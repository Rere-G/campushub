// Shown for a moment while a page's code downloads (stage 17a).
// Waits 200 ms before appearing, so fast loads don't flash a spinner.
export default function PageLoader({ fullScreen = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center bg-[#0d0b07] ${fullScreen ? "min-h-[100dvh]" : "min-h-[60vh] flex-1"}`}
    >
      <span className="ch-loader h-7 w-7 rounded-full border-2 border-[#c9963f]/20 border-t-[#c9963f]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
