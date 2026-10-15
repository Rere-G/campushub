// Shared report logic for listings, services and comments.
// Matches firestore.rules' match /reports/{reportId} exactly:
//   id  = "<uid>_<itemId>"              for a listing or service
//   id  = "<uid>_<itemId>_<commentId>"  for a comment
// so "have I reported this?" is a direct getDoc by id, never a query, and a
// second report of the same thing is refused by the rules.
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export const REPORT_REASONS = [
  { key: "scam", label: "Scam or fraud", hint: "Fake item, asks for payment up front, too good to be true" },
  { key: "prohibited", label: "Prohibited item or service", hint: "Not allowed on campus or against the rules" },
  { key: "offensive", label: "Offensive or abusive", hint: "Hateful, harassing or inappropriate" },
  { key: "spam", label: "Spam", hint: "Repeated, off-topic or advertising" },
  { key: "other", label: "Something else", hint: "Tell us in the note below" },
];

export const REPORT_NOTE_MAX = 300;

export const reportIdFor = (uid, itemId, commentId = "") =>
  commentId ? `${uid}_${itemId}_${commentId}` : `${uid}_${itemId}`;

export async function hasReported(uid, itemId, commentId = "") {
  const snap = await getDoc(doc(db, "reports", reportIdFor(uid, itemId, commentId)));
  return snap.exists();
}

// targetType: "listing" | "service" | "comment"
// itemType:   "listing" | "service" (where the item or comment lives)
// targetOwnerId: the seller / provider / comment author
export async function submitReport({ uid, targetType, itemType, itemId, commentId = "", targetOwnerId, reason, note }) {
  await setDoc(doc(db, "reports", reportIdFor(uid, itemId, commentId)), {
    reporterId: uid,
    targetType,
    itemType,
    itemId,
    commentId,
    targetOwnerId,
    reason,
    note: (note || "").trim().slice(0, REPORT_NOTE_MAX),
    status: "open",
    createdAt: serverTimestamp(),
  });
}
