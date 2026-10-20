import { doc, getDoc, increment, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";

// Owner moves their own listing/service to a new status — the same writes
// ListingDetail and ServiceDetail make (firestore.rules allows the owner
// active/sold/removed on listings and active/paused/removed on services).
// On remove, the old stored counter on users/{uid} is nudged down too, never
// below zero. That counter is only a fallback now (the Dashboard counts real
// documents), so a failure there is only logged.
export async function setPostStatus({ type, id, uid, next }) {
  const col = type === "listing" ? "listings" : "services";
  await updateDoc(doc(db, col, id), { status: next });

  if (next === "removed") {
    const field = type === "listing" ? "listingsCount" : "servicesCount";
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if ((userSnap.data()?.[field] || 0) > 0) {
        await updateDoc(doc(db, "users", uid), { [field]: increment(-1) });
      }
    } catch (err) {
      console.error(`Couldn't update ${field}:`, err);
    }
  }
}
