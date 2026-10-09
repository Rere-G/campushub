import { HiOutlineXMark, HiOutlinePhoto } from "react-icons/hi2";

export default function PhotoSlot({ slotIndex, slot, onChange, onRemove }) {
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
