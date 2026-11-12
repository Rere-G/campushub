// Browse filter (stage 16): Currency All · Ks · $. Min/Max only make sense
// inside one currency, so they appear once Ks or $ is picked.
const OPTIONS = [
  { key: "all", label: "All" },
  { key: "MMK", label: "Ks" },
  { key: "USD", label: "$" },
];

const boxClass =
  "w-24 rounded-xl border border-[#d6bd97]/20 bg-[#090704]/70 px-3 py-2.5 text-sm text-[#f4e6cd] placeholder:text-white/30 outline-none transition focus:border-[#c9963f] focus:shadow-[0_0_0_4px_rgba(201,150,63,0.18)]";

export default function PriceFilter({ currency, setCurrency, minPrice, setMinPrice, maxPrice, setMaxPrice }) {
  const pick = (key) => {
    setCurrency(key);
    setMinPrice("");
    setMaxPrice("");
  };
  const digits = (v) => v.replace(/[^0-9]/g, "").slice(0, 9);

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-xl border border-[#d6bd97]/20 bg-[#090704]/70 p-1" role="group" aria-label="Currency">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={currency === o.key}
            onClick={() => pick(o.key)}
            className={`h-8 min-w-9 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
              currency === o.key ? "bg-[#c9963f]/20 text-[#f4e6cd]" : "text-[#f4e6cd]/45 hover:bg-[#c9963f]/10 hover:text-[#d6bd97]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {currency !== "all" && (
        <>
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Minimum price in ${currency === "USD" ? "dollars" : "Kyat"}`}
            value={minPrice}
            onChange={(e) => setMinPrice(digits(e.target.value))}
            placeholder="Min"
            className={boxClass}
          />
          <span className="text-xs text-[#f4e6cd]/30">–</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Maximum price in ${currency === "USD" ? "dollars" : "Kyat"}`}
            value={maxPrice}
            onChange={(e) => setMaxPrice(digits(e.target.value))}
            placeholder="Max"
            className={boxClass}
          />
        </>
      )}
    </div>
  );
}
