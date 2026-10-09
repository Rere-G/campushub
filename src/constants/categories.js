// Shared category list for Marketplace listings — used by CreateListing
// (the picker) and Marketplace (the browse filter), so the two can never
// drift out of sync. "Services" used to be a category here too, but now
// that Services is its own section (see serviceCategories.js), it's been
// removed to avoid the same concept existing in two places.
export const CATEGORIES = [
  { key: "books", label: "📚 Books & Study" },
  { key: "electronics", label: "💻 Electronics" },
  { key: "clothing", label: "👕 Clothing & Accessories" },
  { key: "dorm", label: "🪑 Dorm & Living" },
  { key: "gaming", label: "🎮 Gaming & Hobbies" },
];

export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key;
