import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineExclamationTriangle,
  HiOutlineTrash,
} from "react-icons/hi2";
import { db } from "../services/firebase";
import { ensurePublicProfile } from "../utils/publicProfile";

const inter = { fontFamily: "'Inter', sans-serif" };

const MAX_LEN = 500;

const timeAgo = (date) => {
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

const card =
  "relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

// Public Q&A thread under a listing or a service. Comments live at
// listings/{id}/comments or services/{id}/comments (see firestore.rules).
// Props:
//   itemType  "listing" | "service"
//   itemId    the parent document id
//   ownerId   the parent's sellerId / providerId (stored on each comment so
//             the rules can verify it and the owner can delete spam)
//   uid       the signed-in user's id
//   closed    true when the parent is removed (rules refuse new comments)
export default function Comments({ itemType, itemId, ownerId, uid, closed = false }) {
  const path = `${itemType === "listing" ? "listings" : "services"}/${itemId}/comments`;
  const noun = itemType === "listing" ? "item" : "service";
  const isOwner = uid === ownerId;

  const [comments, setComments] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState("");

  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const listRef = useRef(null);
  const scrollToEnd = useRef(false);

  const load = useCallback(async () => {
    setLoadErr(false);
    try {
      const snap = await getDocs(query(collection(db, path), orderBy("createdAt", "asc")));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(list);

      const authorIds = [...new Set(list.map((c) => c.authorId))];
      const entries = await Promise.all(
        authorIds.map(async (id) => {
          const s = await getDoc(doc(db, "publicProfiles", id));
          return [id, s.exists() ? s.data() : null];
        })
      );
      setProfiles(Object.fromEntries(entries));
    } catch (err) {
      console.error("Comments load failed:", err);
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // After posting, scroll the thread to the newest comment.
  useEffect(() => {
    if (scrollToEnd.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      scrollToEnd.current = false;
    }
  }, [comments]);

  const trimmed = text.trim();
  const canPost = trimmed.length > 0 && trimmed.length <= MAX_LEN && !posting && !closed;

  const handlePost = async (e) => {
    e?.preventDefault();
    if (!canPost) return;
    setPosting(true);
    setPostErr("");
    try {
      await addDoc(collection(db, path), {
        authorId: uid,
        itemOwnerId: ownerId,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      setText("");
      // So the new comment shows our real name, not "Student". The comment
      // already posted, so a failure here is only logged.
      try {
        await ensurePublicProfile(uid);
      } catch (mirrorErr) {
        console.error("Couldn't sync publicProfiles:", mirrorErr);
      }
      scrollToEnd.current = true;
      await load();
    } catch (err) {
      console.error("Couldn't post comment:", err);
      setPostErr("Couldn't post your comment. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    setDeletingId(commentId);
    setPostErr("");
    try {
      await deleteDoc(doc(db, path, commentId));
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setConfirmId(null);
    } catch (err) {
      console.error("Couldn't delete comment:", err);
      setPostErr("Couldn't delete that comment. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handlePost(e);
  };

  return (
    <section className={`${card} p-5 sm:p-6 md:col-start-1 md:row-start-2`} aria-label="Questions and comments">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg,#8f774b,#c9963f)" }} />
      <div className="mb-4 flex items-center gap-2.5">
        <HiOutlineChatBubbleLeftRight className="h-5 w-5 text-[#d6bd97]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#f4e6cd]/60" style={inter}>
          Questions &amp; comments
        </h2>
        {!loading && !loadErr && (
          <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-medium text-[#f4e6cd]/60">
            {comments.length}
          </span>
        )}
      </div>

      {/* ── Thread ── */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="h-14 flex-1 animate-pulse rounded-2xl bg-white/[0.04]" />
            </div>
          ))}
        </div>
      ) : loadErr ? (
        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
          <HiOutlineExclamationTriangle className="h-5 w-5 text-red-300/70" />
          <p className="mt-2 text-sm text-white/60">Couldn't load comments.</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="mt-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/75 transition-all hover:bg-white/[0.09] hover:text-white"
          >
            Try again
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-sm text-[#f4e6cd]/45">
          No questions yet. Be the first to ask.
        </p>
      ) : (
        <ul ref={listRef} className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
          {comments.map((c) => {
            const p = profiles[c.authorId];
            const name = p?.name || "Student";
            const authorIsOwner = c.authorId === ownerId;
            const canDelete = c.authorId === uid || isOwner;
            return (
              <li key={c.id} className="flex gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-[#f4e6cd]"
                  style={{ background: "linear-gradient(135deg,#8f774b,#c9963f)" }}
                >
                  {p?.photo ? (
                    <img src={p.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (p?.name || "?").trim().charAt(0).toUpperCase() || "?"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-semibold text-white">{name}</span>
                    {authorIsOwner && (
                      <span className="rounded-full bg-[#c9963f]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#d6bd97]">
                        Owner
                      </span>
                    )}
                    <span className="text-[11px] text-[#f4e6cd]/35">{timeAgo(c.createdAt?.toDate?.())}</span>
                    {canDelete && confirmId !== c.id && (
                      <button
                        type="button"
                        onClick={() => setConfirmId(c.id)}
                        aria-label="Delete comment"
                        className="ml-auto rounded-lg p-1 text-[#f4e6cd]/30 transition-colors hover:bg-white/[0.06] hover:text-red-300"
                      >
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#f4e6cd]/80">
                    {c.text}
                  </p>
                  {confirmId === c.id && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-[#f4e6cd]/55">Delete this comment?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="rounded-lg bg-gradient-to-r from-red-500 to-rose-500 px-3 py-1 font-semibold text-white disabled:opacity-60"
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        disabled={deletingId === c.id}
                        className="rounded-lg border border-white/10 px-3 py-1 font-semibold text-white/70 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Compose ── */}
      {closed ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-xs text-[#f4e6cd]/50">
          Comments are closed because this {noun} was removed.
        </p>
      ) : (
        <form onSubmit={handlePost} className="mt-4">
          <label htmlFor={`comment-${itemId}`} className="sr-only">
            {isOwner ? "Reply to a question" : `Ask a question about this ${noun}`}
          </label>
          <textarea
            id={`comment-${itemId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_LEN}
            rows={3}
            placeholder={isOwner ? "Reply to a question…" : `Ask a question about this ${noun}…`}
            className="w-full resize-none rounded-2xl border border-[#d6bd97]/20 bg-[#090704]/70 px-4 py-3 text-sm text-[#f4e6cd] placeholder:text-white/30 outline-none transition focus:border-[#c9963f] focus:shadow-[0_0_0_4px_rgba(201,150,63,0.18)]"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-[#f4e6cd]/35">
              Comments are public. Don't share phone numbers or private details.
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`text-[11px] tabular-nums ${text.length >= MAX_LEN ? "text-[#fca5a5]" : "text-[#f4e6cd]/35"}`}>
                {text.length}/{MAX_LEN}
              </span>
              <button
                type="submit"
                disabled={!canPost}
                className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-xs font-bold uppercase tracking-[0.06em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
          {postErr && (
            <p role="alert" className="mt-2 text-xs text-[#fca5a5]">
              {postErr}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
