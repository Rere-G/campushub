import { HiOutlineMapPin, HiOutlineSparkles } from "react-icons/hi2";
import { conditionLabel, formatPostPrice, meetupLabel } from "../utils/postDetails";

// Detail pages (stage 16): price with a Negotiable tag, then condition and
// meetup spot. Older posts may have none of these; then only the price shows.
export default function PostFacts({ post, isListing }) {
  const condition = isListing ? conditionLabel(post.condition) : "";
  const meetup = meetupLabel(post.meetupSpot);
  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <p className="text-2xl font-bold text-[#d6bd97]">{formatPostPrice(post)}</p>
        {post.negotiable && (
          <span className="rounded-full border border-[#c9963f]/35 px-2 py-0.5 text-[11px] font-semibold text-[#d6bd97]">
            Negotiable
          </span>
        )}
      </div>
      {(condition || meetup) && (
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {condition && (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
              <HiOutlineSparkles className="h-4 w-4 shrink-0 text-[#d6bd97]/70" />
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-[#f4e6cd]/40">Condition</dt>
                <dd className="font-medium text-[#f4e6cd]">{condition}</dd>
              </div>
            </div>
          )}
          {meetup && (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
              <HiOutlineMapPin className="h-4 w-4 shrink-0 text-[#d6bd97]/70" />
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-[#f4e6cd]/40">{isListing ? "Meetup" : "Where"}</dt>
                <dd className="truncate font-medium text-[#f4e6cd]">{meetup}</dd>
              </div>
            </div>
          )}
        </dl>
      )}
    </>
  );
}
