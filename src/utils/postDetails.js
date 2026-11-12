// Post details (stage 16): currency, condition, meetup spot, negotiable.
// Values must match firestore.rules (priceOk / detailOk).

export const CURRENCIES = [
  { key: "MMK", label: "Ks" },
  { key: "USD", label: "$" },
];
export const PRICE_MAX = 100000000;

// Posts from before stage 16 have no currency: they're in Kyat.
export const currencyOf = (post) => (post?.currency === "USD" ? "USD" : "MMK");

const group = (n) => new Intl.NumberFormat("en-US").format(Math.round(Number(n) || 0));

// "Ks 1,500,000" / "$1,200"
export const formatPrice = (amount, currency = "MMK") =>
  currency === "USD" ? `$${group(amount)}` : `Ks ${group(amount)}`;
export const formatPostPrice = (post) => formatPrice(post?.price, currencyOf(post));

export const CONDITIONS = [
  { key: "new", label: "New" },
  { key: "like_new", label: "Like new" },
  { key: "good", label: "Good" },
  { key: "fair", label: "Fair" },
];
export const conditionLabel = (key) => CONDITIONS.find((c) => c.key === key)?.label || "";

// The same public campus spots as chat meetups, plus "Flexible".
export const POST_MEETUP_SPOTS = [
  { key: "flexible", label: "Flexible / agree in chat" },
  { key: "library", label: "Main Library entrance" },
  { key: "canteen", label: "Canteen" },
  { key: "student_union", label: "Student Union" },
  { key: "main_gate", label: "Main Gate" },
  { key: "sports_centre", label: "Sports Centre" },
];
export const meetupLabel = (key) => POST_MEETUP_SPOTS.find((s) => s.key === key)?.label || "";
