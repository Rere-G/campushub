import { useEffect, useRef, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";

// How many recent comments the Dashboard looks at.
export const ACTIVITY_LIMIT = 20;

export const timeAgo = (date) => {
  if (!date) return "just now";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

// Live list of questions other students asked on the user's listings and
// services. One collection-group query over every `comments` subcollection
// (needs the {path=**}/comments rule and the itemOwnerId+createdAt index).
// Each item: { kind: "question", id, itemType, itemId, itemTitle, authorId,
//              authorName, authorPhoto, text, createdAt (Date|null), to }
function useQuestions(uid) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Caches so live updates don't re-fetch the same parent/author every time.
  const parents = useRef(new Map()); // "listings/abc" -> { title, status } | null
  const authors = useRef(new Map()); // uid -> { name, photo } | null

  useEffect(() => {
    if (!uid) return;
    let alive = true;

    const q = query(
      collectionGroup(db, "comments"),
      where("itemOwnerId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(ACTIVITY_LIMIT)
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          // Skip the owner's own replies.
          const raw = snap.docs
            .map((d) => {
              const parentRef = d.ref.parent.parent; // listings/{id} or services/{id}
              const data = d.data();
              return {
                id: d.id,
                parentPath: parentRef.path,
                itemType: parentRef.parent.id === "listings" ? "listing" : "service",
                itemId: parentRef.id,
                authorId: data.authorId,
                text: data.text || "",
                createdAt: data.createdAt?.toDate?.() ?? null,
              };
            })
            .filter((c) => c.authorId !== uid);

          const needParents = [...new Set(raw.map((c) => c.parentPath))].filter(
            (p) => !parents.current.has(p)
          );
          const needAuthors = [...new Set(raw.map((c) => c.authorId))].filter(
            (a) => !authors.current.has(a)
          );

          await Promise.all([
            ...needParents.map(async (p) => {
              const s = await getDoc(doc(db, p));
              parents.current.set(
                p,
                s.exists() ? { title: s.data().title || "Untitled", status: s.data().status } : null
              );
            }),
            ...needAuthors.map(async (a) => {
              try {
                const s = await getDoc(doc(db, "publicProfiles", a));
                authors.current.set(a, s.exists() ? s.data() : null);
              } catch {
                authors.current.set(a, null);
              }
            }),
          ]);

          const list = raw
            .map((c) => {
              const parent = parents.current.get(c.parentPath);
              // Item deleted or removed by its owner/admin: nothing to open.
              if (!parent || parent.status === "removed") return null;
              const author = authors.current.get(c.authorId);
              const photo = author?.photo || "";
              return {
                ...c,
                kind: "question",
                itemTitle: parent.title,
                authorName: author?.name?.trim() || "Student",
                authorPhoto: /^https?:\/\//i.test(photo) ? photo : "",
                to: `/${c.itemType === "listing" ? "marketplace" : "services"}/${c.itemId}#comments`,
              };
            })
            .filter(Boolean);

          if (!alive) return;
          setItems(list);
          setError(false);
        } catch (err) {
          console.error("Activity load failed:", err);
          if (alive) setError(true);
        } finally {
          if (alive) setLoading(false);
        }
      },
      (err) => {
        // Most likely cause right after deploy: the index is still building.
        console.error("Activity query failed:", err);
        if (!alive) return;
        setError(true);
        setLoading(false);
      }
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [uid]);

  return { items, loading, error };
}

// Live system notifications for this student (stage 14c rules: only their own,
// newest first; needs the uid+createdAt index). Each item:
// { kind: "post_removed" | "account_approved" | "report_handled", id, itemType,
//   itemId, itemTitle, reason, outcome, createdAt (Date|null), to (string|null) }
function useNotifications(uid) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const q = query(
      collection(db, "notifications"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(ACTIVITY_LIMIT)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!alive) return;
        setItems(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              kind: x.type,
              id: d.id,
              itemType: x.itemType || "",
              itemId: x.itemId || "",
              itemTitle: x.itemTitle || "",
              reason: x.reason || "",
              outcome: x.outcome || "",
              createdAt: x.createdAt?.toDate?.() ?? null,
              // Only a removal has somewhere useful to go: the item page,
              // which shows the owner "Removed by a moderator".
              to:
                x.type === "post_removed" && x.itemId
                  ? `/${x.itemType === "service" ? "services" : "marketplace"}/${x.itemId}`
                  : null,
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        // Not fatal: questions still show. Usually the index is still building.
        console.error("Notifications query failed:", err);
        if (alive) setLoading(false);
      }
    );
    return () => {
      alive = false;
      unsub();
    };
  }, [uid]);

  return { items, loading };
}

const timeOf = (x) => (x.createdAt ? x.createdAt.getTime() : Number.MAX_SAFE_INTEGER);

// The Activity feed: questions on my items + system notifications, newest
// first. `error` is only set when questions fail to load.
export function useActivity(uid) {
  const questions = useQuestions(uid);
  const notifications = useNotifications(uid);
  const items = [...questions.items, ...notifications.items]
    // An item still waiting for its server timestamp counts as the newest.
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, ACTIVITY_LIMIT);
  return {
    items,
    loading: questions.loading || notifications.loading,
    error: questions.error,
  };
}

// Everything older than this moment counts as read.
export async function markActivityRead(uid) {
  await updateDoc(doc(db, "users", uid), { activitySeenAt: serverTimestamp() });
}
