import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A fully custom dropdown, not a native <select>. Two problems this avoids:
// 1. Native <option> background colors are partly OS-rendered on Windows and
//    don't reliably respect CSS across browsers.
// 2. The list is rendered through a PORTAL straight into document.body, so it
//    is never a DOM descendant of this card — meaning the card's own
//    overflow-hidden (needed to clip its rounded top accent bar) can never
//    clip or cut off the open dropdown list, no matter where in the form
//    this field sits or how little room is left below it.
export default function CategorySelect({ value, onChange, options, inputClass }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const selected = options.find((o) => o.key === value);

  const openDropdown = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        listRef.current &&
        !listRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Simplest robust behavior: close on scroll/resize rather than tracking
    // and repositioning live — this is a short form, not a long page.
    // Scrolling inside the list itself must NOT close it (the capture-phase
    // listener below sees those scroll events too).
    const onScrollOrResize = (e) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputClass} flex items-center justify-between text-left`}
      >
        <span className={selected ? "" : "text-white/30"}>{selected ? selected.label : "Select…"}</span>
        <svg
          viewBox="0 0 16 16"
          className={`h-4 w-4 shrink-0 text-[#d6bd97] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
            className="z-[100] max-h-56 overflow-y-auto overscroll-contain rounded-2xl border border-[#d6bd97]/25 bg-[#1e211e] py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
          >
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                role="option"
                aria-selected={o.key === value}
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${
                  o.key === value ? "bg-[#c9963f]/15 text-[#d6bd97]" : "text-[#f4e6cd]/85 hover:bg-white/[0.06]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
