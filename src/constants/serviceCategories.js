// Shared category list for Services — mirrors categories.js's role for
// Marketplace listings. Keeping this in its own file (rather than folding
// into categories.js) keeps the two concepts separate, matching firestore.rules'
// separate category enum for /services vs /listings.
export const SERVICE_CATEGORIES = [
  { key: "tutoring", label: "📚 Tutoring & Academic" },
  { key: "tech", label: "💻 Tech & Repair" },
  { key: "design", label: "🎨 Design & Creative" },
  { key: "writing", label: "✍️ Writing & Editing" },
  { key: "events", label: "📸 Events & Photography" },
  { key: "other", label: "✨ Other" },
];

export const serviceCategoryLabel = (key) => SERVICE_CATEGORIES.find((c) => c.key === key)?.label || key;
