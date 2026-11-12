import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

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

// For multi-step actions (e.g. handling a report: remove content, close every
// matching report, notify people) the log entry is written once everything
// has succeeded. A logging failure is reported in the console but never
// undoes the moderation action itself.
export async function addLog(entry) {
  const actorId = auth.currentUser?.uid;
  if (!actorId) return;
  try {
    await setDoc(newLogRef(), logEntry({ actorId, ...entry }));
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}

// What each action looks like in the Activity log.
export const ACTION_TEXT = {
  user_approved: "approved",
  user_revoked: "revoked approval for",
  user_banned: "banned",
  user_unbanned: "unbanned",
  changes_requested: "requested changes from",
  post_removed: "removed",
  post_restored: "restored",
  post_locked: "locked",
  report_dismissed: "dismissed a report on",
  report_actioned: "acted on a report about",
  message_removed: "removed a reported message in",
  announcement_updated: "updated the announcement",
};
export const ACTION_GROUP = (action) =>
  action.startsWith("user_") || action === "changes_requested"
    ? "users"
    : action.startsWith("post_")
    ? "posts"
    : action.startsWith("report_") || action === "message_removed"
    ? "reports"
    : "announcements";
