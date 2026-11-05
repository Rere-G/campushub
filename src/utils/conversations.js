import { useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { isConversationUnread } from "./chat";

// Live list of my chats, newest first (needs the participants + updatedAt
// index from 15a). A chat the other person opened but never wrote in is
// hidden from the seller until the first message arrives.
// Each item: { ...conversation, id, otherId, otherName, otherPhoto, role, unread, updated }
export function useConversations(uid) {
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const profiles = useRef(new Map()); // uid -> { name, photo } | null

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", uid),
      orderBy("updatedAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const raw = snap.docs
          .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
          .filter((c) => c.lastSenderId || c.buyerId === uid);

        const missing = [...new Set(raw.map((c) => (c.buyerId === uid ? c.sellerId : c.buyerId)))].filter(
          (id) => !profiles.current.has(id)
        );
        await Promise.all(
          missing.map(async (id) => {
            try {
              const s = await getDoc(doc(db, "publicProfiles", id));
              profiles.current.set(id, s.exists() ? s.data() : null);
            } catch {
              profiles.current.set(id, null);
            }
          })
        );
        if (!alive) return;

        setConvs(
          raw.map((c) => {
            const otherId = c.buyerId === uid ? c.sellerId : c.buyerId;
            const p = profiles.current.get(otherId);
            return {
              ...c,
              otherId,
              otherName: p?.name?.trim() || "Student",
              otherPhoto: /^https?:\/\//i.test(p?.photo || "") ? p.photo : "",
              role: c.buyerId === uid ? "buying" : "selling",
              unread: isConversationUnread(c, uid),
              updated: c.updatedAt?.toDate?.() ?? null,
            };
          })
        );
        setError(false);
        setLoading(false);
      },
      (err) => {
        // Usually: the conversations index is still building.
        console.error("Inbox query failed:", err);
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

  const unreadCount = convs.filter((c) => c.unread).length;
  return { convs, loading, error, unreadCount };
}

// "2m", "3h", "Tue", "12 Oct" — short times for the inbox.
export function shortTime(d) {
  if (!d) return "";
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return "now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 7 * 86400) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}
