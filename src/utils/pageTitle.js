import { useEffect } from "react";

// Browser tab titles (stage 17b): "Marketplace · CampusHub", with the number
// of unread chats in front on signed-in pages: "(2) Marketplace · CampusHub".
const DEFAULT_TITLE = "CampusHub — Student Marketplace";
let page = "";
let badge = 0;

function apply() {
  const name = page ? `${page} · CampusHub` : DEFAULT_TITLE;
  document.title = badge > 0 ? `(${badge}) ${name}` : name;
}

// Call once at the top of a page. Pass null to leave the title alone
// (e.g. Messages while an open chat sets its own).
export function usePageTitle(title) {
  useEffect(() => {
    if (title === null) return;
    page = title || "";
    apply();
  }, [title]);
}

// Used by the app shell: unread chats shown in front of every title.
export function useTitleBadge(count) {
  useEffect(() => {
    badge = count > 0 ? count : 0;
    apply();
    return () => {
      badge = 0;
      apply();
    };
  }, [count]);
}
