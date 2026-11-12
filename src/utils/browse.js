import { useState } from "react";

// Stage 18a-1: browse helpers shared by Marketplace and Services.

const DAY = 24 * 60 * 60 * 1000;
const millis = (p) => p.createdAt?.toMillis?.() || 0;

// Posted in the last 24 hours.
export const isNewPost = (p) => {
  const t = millis(p);
  return t > 0 && Date.now() - t < DAY;
};

export function sortPosts(list, sort) {
  const out = [...list];
  if (sort === "price_asc") return out.sort((a, b) => (a.price || 0) - (b.price || 0) || millis(b) - millis(a));
  if (sort === "price_desc") return out.sort((a, b) => (b.price || 0) - (a.price || 0) || millis(b) - millis(a));
  return out.sort((a, b) => millis(b) - millis(a));
}

// Grid or list, remembered on this device (falls back to grid if storage is blocked).
export function useBrowseView(key) {
  const storageKey = `ch-view-${key}`;
  const [view, setViewState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  const setView = (v) => {
    setViewState(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      /* not remembered, still works */
    }
  };
  return [view, setView];
}
