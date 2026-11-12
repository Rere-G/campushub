import { collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

// Stage 18c: admin audit log. Each admin action writes one entry IN THE SAME
// BATCH as the change itself, so the change and its log entry are saved
// together or not at all. firestore.rules make entries append-only.
export const newLogRef = () => doc(collection(db, "adminLog"));

export const logEntry = ({ actorId, action, targetType, targetId, targetLabel = "", reason = "" }) => ({
  actorId,
  action,
  targetType,
  targetId: String(targetId).slice(0, 200),
  targetLabel: String(targetLabel || "").slice(0, 200),
  reason: String(reason || "").slice(0, 300),
  createdAt: serverTimestamp(),
});

// Ready-made reasons for "Request changes" (the admin can also type their own).
export const REVIEW_REASONS = [
  "Please add your student ID number.",
  "Please use your real full name.",
  "Please add your university and department.",
  "Please add a clear profile photo of yourself.",
  "Your student ID doesn't look right. Please check it.",
];
