import { HiCheck } from "react-icons/hi2";
import CategorySelect from "./CategorySelect";
import { CONDITIONS, CURRENCIES, POST_MEETUP_SPOTS, formatPrice } from "../utils/postDetails";

// Shared form pieces for Create Listing / Create Service (stage 16).

// Price box with a Ks | $ switch. Whole numbers only.
export function PriceField({ price, setPrice, currency, setCurrency, inputClass, labelClass }) {
  const num = Math.round(Number(price));
  const symbol = currency === "USD" ? "$" : "Ks";
  return (
    <div>
      {/* The switch overlaps the label's spacing, so this row is exactly as tall
          as a plain label and the box lines up with the field beside it. */}
      <div className="flex items-start justify-between">
        <label htmlFor="post-price" className={labelClass}>Price</label>
        <div className="-mt-[5px] flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5" role="group" aria-label="Currency">
          {CURRENCIES.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={currency === c.key}
              onClick={() => setCurrency(c.key)}
              className={`h-6 min-w-8 rounded-md px-2 text-[11px] font-bold transition-colors ${
                currency === c.key ? "bg-[#c9963f]/25 text-[#f4e6cd]" : "text-white/45 hover:bg-[#c9963f]/10 hover:text-[#d6bd97]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#d6bd97]/70">
          {symbol}
        </span>
        <input
          id="post-price"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
          placeholder="0"
          className={`${inputClass} ${currency === "USD" ? "pl-8" : "pl-10"} [appearance:textfield] hover:border-[#c9963f]/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
      </div>
      <p className="mt-1.5 h-4 text-[11px] text-[#f4e6cd]/40">{num > 0 ? `= ${formatPrice(num, currency)}` : " "}</p>
    </div>
  );
}

// Condition (listings only), meetup spot and negotiable.
export function DetailsFields({
  isListing,
  condition,
  setCondition,
  meetupSpot,
  setMeetupSpot,
  negotiable,
  setNegotiable,
  inputClass,
  labelClass,
}) {
  return (
    <div className="space-y-4">
      {isListing && (
        <fieldset>
          <legend className={labelClass}>
            Condition <span className="text-[#f4e6cd]/40">(required)</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CONDITIONS.map((c) => (
              <label
                key={c.key}
                className={`flex h-10 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#c9963f]/60 ${
                  condition === c.key
                    ? "border-[#c9963f]/60 bg-[#c9963f]/12 text-[#f4e6cd]"
                    : "border-white/10 bg-white/[0.03] text-[#f4e6cd]/65 hover:border-[#c9963f]/50 hover:bg-[#c9963f]/[0.06] hover:text-[#d6bd97]"
                }`}
              >
                <input
                  type="radio"
                  name="post-condition"
                  value={c.key}
                  checked={condition === c.key}
                  onChange={() => setCondition(c.key)}
                  className="sr-only"
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className={labelClass}>{isListing ? "Meetup spot" : "Where it happens"}</p>
          <CategorySelect
            value={meetupSpot}
            onChange={setMeetupSpot}
            options={POST_MEETUP_SPOTS}
            inputClass={inputClass}
            label={isListing ? "Meetup spot" : "Where it happens"}
          />
          <p className="mt-1.5 text-[11px] text-[#f4e6cd]/40">Public campus spots only. Never your home address.</p>
        </div>
        {/* Top padding = the height of a field label; the box is an input's height. */}
        <div className="sm:pt-7">
          <label className="group flex h-[50px] cursor-pointer items-center gap-3 rounded-2xl border border-[#d6bd97]/25 bg-[#090704]/70 px-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c9963f]/50 has-[:focus-visible]:border-[#c9963f] has-[:focus-visible]:shadow-[0_0_0_4px_rgba(201,150,63,0.18)]">
            <input
              type="checkbox"
              checked={negotiable}
              onChange={(e) => setNegotiable(e.target.checked)}
              className="peer sr-only"
            />
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#d6bd97]/35 text-transparent transition-colors group-hover:border-[#c9963f]/70 peer-checked:border-[#c9963f] peer-checked:bg-[#c9963f] peer-checked:text-[#1a120a]">
              <HiCheck className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-medium text-[#f4e6cd]">Price negotiable</span>
          </label>
          <p className="mt-1.5 text-[11px] text-[#f4e6cd]/40">Shows a "Negotiable" tag on your post.</p>
        </div>
      </div>
    </div>
  );
}
