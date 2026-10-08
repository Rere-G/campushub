// Shared category list — used by CreateListing (the picker) and Marketplace
// (the browse filter), so the two can never drift out of sync.
export const CATEGORIES = [
  { key: "books", label: "📚 Books & Study" },
  { key: "electronics", label: "💻 Electronics" },
  { key: "clothing", label: "👕 Clothing & Accessories" },
  { key: "dorm", label: "🪑 Dorm & Living" },
  { key: "gaming", label: "🎮 Gaming & Hobbies" },
  { key: "services", label: "🛠️ Services" },
];

export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key;
