import { useEffect, useState } from "react";
import { HiOutlineSignal, HiOutlineSignalSlash } from "react-icons/hi2";

// Stage 17b: a slim bar at the top when the connection drops, and a short
// "Back online" when it returns.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    let timer;
    const goOffline = () => {
      clearTimeout(timer);
      setBackOnline(false);
      setOnline(false);
    };
    const goOnline = () => {
      setOnline(true);
      setBackOnline(true);
      clearTimeout(timer);
      timer = setTimeout(() => setBackOnline(false), 3000);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const visible = !online || backOnline;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))] transition-all duration-300 motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {visible && (
        <div
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md ${
            online
              ? "border-[#c9963f]/40 bg-[#1b160d]/95 text-[#f4e6cd]"
              : "border-[#f87171]/35 bg-[#1f1310]/95 text-[#fcd9cf]"
          }`}
        >
          {online ? (
            <>
              <HiOutlineSignal className="h-4 w-4 text-[#d6bd97]" /> Back online
            </>
          ) : (
            <>
              <HiOutlineSignalSlash className="h-4 w-4 text-[#fca5a5]" />
              You're offline. Some things won't load or save until you reconnect.
            </>
          )}
        </div>
      )}
    </div>
  );
}
