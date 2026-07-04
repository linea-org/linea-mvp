"use client"

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
import { useState, useEffect, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Loading01Icon,
  CheckmarkCircle01Icon,
  ArrowUp01Icon,
  BubbleChatAddIcon,
  SmileIcon,
  ArrowTurnBackwardIcon,
  MoreHorizontalIcon,
  Delete01Icon,
  PinIcon,
  Link01Icon,
  Attachment01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@linea/ui/components/button"
import { Textarea } from "@linea/ui/components/textarea"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@linea/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@linea/ui/components/dropdown-menu"
import { type Node } from "@xyflow/react"
import { createApiClient } from "@/lib/api"
=======
import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon, Loading01Icon, CheckmarkCircle01Icon, ArrowUp01Icon,
  BubbleChatAddIcon, SmileIcon, ArrowTurnBackwardIcon, MoreHorizontalIcon,
  Delete01Icon, PinIcon, Link01Icon, Attachment01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Textarea } from '@linea/ui/components/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@linea/ui/components/avatar';
import { Spinner } from '@linea/ui/components/spinner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@linea/ui/components/dropdown-menu';
import { type Node } from '@xyflow/react';
import { friendlyApiError } from '@/lib/api';
import { useApiClient } from '@/hooks/use-api-client';
import { toast } from '@linea/ui/components/sonner';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx

interface Reaction {
  emoji: string
  count: number
  reacted: boolean
}
interface Comment {
  id: string
  nodeId: string | null
  userId: string
  userClerkId: string | null
  userName: string | null
  userEmail: string
  userAvatarUrl: string | null
  body: string
  resolved: boolean
  pinned: boolean
  createdAt: string
  reactions: Reaction[]
  replies: Comment[]
}
interface Props {
<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
  token: string
  workspaceId: string
  podId: string
  workflowId: string
  nodes: Node[]
  selectedNodeId?: string | null
  currentUserId?: string
  onClose: () => void
=======
  workspaceId: string; podId: string; workflowId: string;
  nodes: Node[]; selectedNodeId?: string | null; currentUserId?: string; onClose: () => void;
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
}

const BASE_PATH = (ws: string, pod: string, wf: string) =>
  `/workspaces/${ws}/pods/${pod}/workflows/${wf}/comments`
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"]

// px from reply-item top to the horizontal elbow (= card py-2.5 + half avatar size-5)
const ELBOW_Y = 20
// px from left of connector column where the vertical line is drawn
const LINE_X = 8
// width of horizontal elbow arm in px
const ELBOW_W = 12

function toggleCommentField(
  list: Comment[],
  id: string,
  field: 'resolved' | 'pinned',
  value: boolean,
): Comment[] {
  return list.map((c) =>
    c.id === id
      ? { ...c, [field]: value }
      : { ...c, replies: toggleCommentField(c.replies, id, field, value) },
  );
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return "now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function ReactionPicker({ onReact }: { onReact: (e: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Add reaction"
        className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <HugeiconsIcon icon={SmileIcon} className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-1 flex gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onReact(e)
                setOpen(false)
              }}
              className="rounded p-1 text-sm transition-colors hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReplyConnector({
  isLast,
  elbow = true,
  isCollapsed,
  onClick,
}: {
  isLast: boolean
  elbow?: boolean
  isCollapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? "Expand replies" : "Collapse replies"}
      className="group/line relative w-5 shrink-0 cursor-pointer self-stretch"
    >
      <span
        className="absolute w-px rounded-full bg-border/60 transition-colors group-hover/line:bg-primary/60"
        style={{
          left: LINE_X,
          top: 0,
          ...(isLast ? { height: ELBOW_Y } : { bottom: 0 }),
        }}
      />
      {elbow && (
        <span
          className="absolute h-px rounded-full bg-border/60 transition-colors group-hover/line:bg-primary/60"
          style={{ left: LINE_X, top: ELBOW_Y, width: ELBOW_W }}
        />
      )}
    </button>
  )
}

function CommentCard({
  comment,
  isTopLevel,
  currentUserId,
  onResolve,
  onReply,
  onReact,
  onDelete,
  onPin,
}: {
  comment: Comment
  isTopLevel: boolean
  currentUserId?: string
  onResolve: (id: string, resolved: boolean) => void
  onReply: (id: string, userName: string | null) => void
  onReact: (id: string, emoji: string) => void
  onDelete: (id: string) => void
  onPin: (id: string, pinned: boolean) => void
}) {
  const initials = (
    (comment.userName ?? comment.userEmail)[0] ?? "?"
  ).toUpperCase()
  const visibleReactions = comment.reactions.filter((r) => r.count > 0)
  const isOwner = !!currentUserId && currentUserId === comment.userClerkId

  return (
<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
    <div
      className={`group space-y-1.5 rounded-lg border border-border px-3 py-2.5 transition-opacity ${comment.resolved ? "opacity-40" : ""} ${comment.pinned ? "border-primary/30 bg-primary/5" : ""}`}
    >
      {/* Meta row */}
=======
    <div className={`group rounded-lg border border-border px-3 py-2.5 space-y-1.5 transition-opacity ${comment.resolved ? 'opacity-40' : ''} ${comment.pinned ? 'border-primary/30 bg-primary/5' : ''}`}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar className="size-5 shrink-0">
            {comment.userAvatarUrl && (
              <AvatarImage src={comment.userAvatarUrl} />
            )}
            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="max-w-[7rem] truncate text-xs font-medium">
            {comment.userName ?? comment.userEmail.split("@")[0]}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground/60">
            {timeAgo(comment.createdAt)}
          </span>
          {comment.pinned && (
            <span className="shrink-0 text-[10px] font-medium text-primary/60">
              pinned
            </span>
          )}
        </div>

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
        {/* Resolve + more menu */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
=======
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
          {isTopLevel && (
            <button
              onClick={() => onResolve(comment.id, !comment.resolved)}
              title={comment.resolved ? "Reopen" : "Resolve"}
              className={`rounded p-1 transition-colors ${
                comment.resolved
                  ? "text-green-600"
                  : "text-muted-foreground hover:text-green-600"
              }`}
            >
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon}
                className="size-3.5"
              />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                onClick={() => onPin(comment.id, !comment.pinned)}
              >
                <HugeiconsIcon
                  icon={PinIcon}
                  className="size-3.5 text-muted-foreground"
                />
                {comment.pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onReply(comment.id, comment.userName)}
              >
                <HugeiconsIcon
                  icon={ArrowTurnBackwardIcon}
                  className="size-3.5 text-muted-foreground"
                />
                Reply
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(comment.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
      {/* Body */}
      <p className="text-xs leading-relaxed text-foreground/90">
        {comment.body}
      </p>

      {/* Reactions + quick actions */}
      <div className="flex flex-wrap items-center gap-1">
=======
      <p className="text-xs leading-relaxed text-foreground/90">{comment.body}</p>

      <div className="flex items-center gap-1 flex-wrap">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
        {visibleReactions.map((r) => (
          <button
            key={r.emoji}
            onClick={() => onReact(comment.id, r.emoji)}
            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
              r.reacted
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-muted/30 text-foreground/80 hover:bg-muted"
            }`}
          >
            <span>{r.emoji}</span>
            <span className="font-medium">{r.count}</span>
          </button>
        ))}

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
        {/* Quick action icons — appear on hover */}
        <div className="ml-auto flex items-center gap-0 opacity-0 transition-opacity group-hover:opacity-100">
=======
        <div className="ml-auto flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
          <ReactionPicker onReact={(e) => onReact(comment.id, e)} />
          <button
            onClick={() => onReply(comment.id, comment.userName)}
            title="Reply"
            className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// When collapsed: hides ALL replies and shows an expand pill.
// This gives a clear visual signal regardless of reply count.
function CommentThread({
  comment,
  depth,
  collapsedIds,
  onToggle,
  onResolve,
  onReply,
  onReact,
  onDelete,
  onPin,
  currentUserId,
}: {
  comment: Comment
  depth: number
  collapsedIds: Set<string>
  onToggle: (id: string) => void
  onResolve: (id: string, resolved: boolean) => void
  onReply: (id: string, userName: string | null) => void
  onReact: (id: string, emoji: string) => void
  onDelete: (id: string) => void
  onPin: (id: string, pinned: boolean) => void
  currentUserId?: string
}) {
  const replies = comment.replies
  const hasReplies = replies.length > 0
  const isCollapsed = hasReplies && collapsedIds.has(comment.id)
  const toggleThis = () => onToggle(comment.id)
  const sharedProps = {
    onResolve,
    onReply,
    onReact,
    onDelete,
    onPin,
    currentUserId,
  }

  // Reply thread lines are built from absolutely-positioned spans: a vertical bridge from the
  // parent card, then (when collapsed) a short stub + horizontal arm forming an elbow to the pill.
  return (
    <div>
      <CommentCard
        comment={comment}
        isTopLevel={depth === 0}
        {...sharedProps}
      />

      {hasReplies && (
        <div className="ml-2.5">
          <div className="relative h-1.5">
            <span
              className="absolute w-px bg-border/50"
              style={{ left: LINE_X, top: 0, bottom: 0 }}
            />
          </div>

          {isCollapsed ? (
            <div className="flex items-center">
              <button
                onClick={toggleThis}
                className="group/line relative w-5 shrink-0 cursor-pointer self-stretch"
                title="Expand replies"
              >
                <span
                  className="absolute w-px rounded-full bg-border/60 transition-colors group-hover/line:bg-primary/60"
                  style={{ left: LINE_X, top: 0, height: 16 }}
                />
                <span
                  className="absolute h-px rounded-full bg-border/60 transition-colors group-hover/line:bg-primary/60"
                  style={{ left: LINE_X, top: 16, width: ELBOW_W }}
                />
              </button>
              <button
                onClick={toggleThis}
                className="flex-1 py-1 text-left text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {replies.length} {replies.length === 1 ? "reply" : "replies"} —
                click to expand
              </button>
            </div>
          ) : (
            /* ── Expanded: all replies with tree connectors ── */
            replies.map((reply, idx) => {
              const isLast = idx === replies.length - 1
              return (
                <div key={reply.id} className="flex">
                  <ReplyConnector
                    isLast={isLast}
                    isCollapsed={isCollapsed}
                    onClick={toggleThis}
                  />
                  <div className="min-w-0 flex-1 pb-1.5">
                    <CommentThread
                      comment={reply}
                      depth={depth + 1}
                      collapsedIds={collapsedIds}
                      onToggle={onToggle}
                      {...sharedProps}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function AttachBar({
  onLink,
  onFile,
  uploading,
}: {
  onLink: () => void
  onFile: () => void
  uploading?: boolean
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onFile}
        disabled={uploading}
        title={uploading ? "Uploading…" : "Attach file"}
        className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <HugeiconsIcon
          icon={uploading ? Loading01Icon : Attachment01Icon}
          className={`size-3.5 ${uploading ? "animate-spin" : ""}`}
        />
      </button>
      <button
        onClick={onLink}
        title="Attach link"
        className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <HugeiconsIcon icon={Link01Icon} className="size-3.5" />
      </button>
    </div>
  )
}

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
/* ── CommentsPanel ──────────────────────────────────────────────────────── */
export function CommentsPanel({
  token,
  workspaceId,
  podId,
  workflowId,
  nodes,
  selectedNodeId,
  currentUserId,
  onClose,
}: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterNodeId, setFilterNodeId] = useState<string | "all">("all")
  const [body, setBody] = useState("")
  const [replyTo, setReplyTo] = useState<{
    id: string
    userName: string | null
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [linkPrompt, setLinkPrompt] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const api = createApiClient(token)
  const path = BASE_PATH(workspaceId, podId, workflowId)

  useEffect(() => {
    if (selectedNodeId) setFilterNodeId(selectedNodeId)
  }, [selectedNodeId])
=======
export function CommentsPanel({ workspaceId, podId, workflowId, nodes, selectedNodeId, currentUserId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [filterNodeId, setFilterNodeId] = useState<string | 'all'>('all');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string | null } | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [linkPrompt, setLinkPrompt] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getApi = useApiClient();
  const path = BASE_PATH(workspaceId, podId, workflowId);

  const [prevSelectedNodeId, setPrevSelectedNodeId] = useState(selectedNodeId);
  if (selectedNodeId !== prevSelectedNodeId) {
    setPrevSelectedNodeId(selectedNodeId);
    if (selectedNodeId) setFilterNodeId(selectedNodeId);
  }
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
  async function load() {
    setLoading(true)
    try {
      const data = await api.get<Comment[]>(path)
=======
  const { data: fetchedComments, isLoading: loading, refetch } = useQuery({
    queryKey: ['workflow-comments', workspaceId, podId, workflowId],
    queryFn: async () => {
      const api = await getApi();
      const data = await api.get<Comment[]>(path);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
      const normalise = (c: Comment): Comment => ({
        ...c,
        reactions: c.reactions ?? [],
        replies: (c.replies ?? []).map(normalise),
<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
      })
      setComments((data ?? []).map(normalise))
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await api.post(path, {
        body: trimmed,
        nodeId: filterNodeId !== "all" ? filterNodeId : null,
        parentId: replyTo?.id ?? undefined,
      })
      setBody("")
      setReplyTo(null)
      await load()
    } catch {
      /* endpoint may not exist yet */
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResolve(id: string, resolved: boolean) {
    try {
      await api.patch(`${path}/${id}`, { resolved })
      const toggle = (c: Comment): Comment =>
        c.id === id
          ? { ...c, resolved }
          : { ...c, replies: c.replies.map(toggle) }
      setComments((prev) => prev.map(toggle))
    } catch {
      /* silently ignore */
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`${path}/${id}`)
      const remove = (list: Comment[]): Comment[] =>
        list
          .filter((c) => c.id !== id)
          .map((c) => ({ ...c, replies: remove(c.replies) }))
      setComments((prev) => remove(prev))
    } catch {
      /* silently ignore */
    }
  }

  async function handlePin(id: string, pinned: boolean) {
    try {
      await api.patch(`${path}/${id}`, { pinned })
      const toggle = (c: Comment): Comment =>
        c.id === id
          ? { ...c, pinned }
          : { ...c, replies: c.replies.map(toggle) }
      setComments((prev) => prev.map(toggle))
    } catch {
      /* silently ignore — pin may not be supported yet */
    }
  }

  async function handleReact(commentId: string, emoji: string) {
    try {
      await api.post(`${path}/${commentId}/react`, { emoji })
=======
      });
      return (data ?? []).map(normalise);
    },
  });

  if (fetchedComments && loadedFor !== path) {
    setLoadedFor(path);
    setComments(fetchedComments);
  }


  async function load() {
    const result = await refetch();
    if (result.data) setComments(result.data);
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      await api.post(path, {
        body: body.trim(),
        nodeId: filterNodeId !== 'all' ? filterNodeId : null,
        parentId: replyTo?.id ?? undefined,
      });
    },
    onSuccess: async () => {
      setBody('');
      setReplyTo(null);
      await load();
    },
  });

  function handleSubmit() {
    if (!body.trim()) return;
    submitMutation.mutate();
  }

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const api = await getApi();
      await api.patch(`${path}/${id}`, { resolved });
      return { id, resolved };
    },
    onSuccess: ({ id, resolved }) => setComments((prev) => toggleCommentField(prev, id, 'resolved', resolved)),
  });

  function handleResolve(id: string, resolved: boolean) {
    resolveMutation.mutate({ id, resolved });
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      await api.delete(`${path}/${id}`);
      return id;
    },
    onSuccess: (id) => {
      const remove = (list: Comment[]): Comment[] =>
        list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: remove(c.replies) }));
      setComments((prev) => remove(prev));
    },
  });

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  const pinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const api = await getApi();
      await api.patch(`${path}/${id}`, { pinned });
      return { id, pinned };
    },
    onSuccess: ({ id, pinned }) => setComments((prev) => toggleCommentField(prev, id, 'pinned', pinned)),
  });

  function handlePin(id: string, pinned: boolean) {
    pinMutation.mutate({ id, pinned });
  }

  const reactMutation = useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string }) => {
      const api = await getApi();
      await api.post(`${path}/${commentId}/react`, { emoji });
      return { commentId, emoji };
    },
    onSuccess: ({ commentId, emoji }) => {
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
      const update = (c: Comment): Comment => {
        if (c.id === commentId) {
          const existing = c.reactions.find((r) => r.emoji === emoji)
          const reactions = existing
            ? c.reactions.map((r) =>
                r.emoji === emoji
                  ? {
                      ...r,
                      count: r.reacted ? r.count - 1 : r.count + 1,
                      reacted: !r.reacted,
                    }
                  : r
              )
            : [...c.reactions, { emoji, count: 1, reacted: true }]
          return { ...c, reactions }
        }
<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
        return { ...c, replies: c.replies.map(update) }
      }
      setComments((prev) => prev.map(update))
    } catch {
      /* silently ignore */
=======
        return { ...c, replies: c.replies.map(update) };
      };
      setComments((prev) => prev.map(update));
    },
  });

  function handleReact(commentId: string, emoji: string) {
    reactMutation.mutate({ commentId, emoji });
  }

  function handleReply(id: string, userName: string | null) {
    setReplyTo({ id, userName });
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function insertLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setBody((b) => b + (b ? ' ' : '') + url);
    setLinkUrl('');
    setLinkPrompt(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      // 1. Get a presigned URL from the API
      const presignPath = `/workspaces/${workspaceId}/uploads/presign`;
      const api = await getApi();
      const { presignedUrl, publicUrl } = await api.post<{ presignedUrl: string; publicUrl: string; key: string }>(
        presignPath,
        { filename: file.name, contentType: file.type, size: file.size },
      );

      // 2. PUT the file directly to R2
      await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // 3. Insert the public URL into the comment body
      const label = publicUrl || file.name;
      setBody((b) => b + (b ? '\n' : '') + label);
    } catch (err) {
      toast.error(friendlyApiError(err));
      // Fallback: insert filename so the comment still references what was attached
      setBody((b) => b + (b ? ' ' : '') + `[file: ${file.name}]`);
    } finally {
      setUploading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
    }
  }

  function handleReply(id: string, userName: string | null) {
    setReplyTo({ id, userName })
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function insertLink() {
    const url = linkUrl.trim()
    if (!url) return
    setBody((b) => b + (b ? " " : "") + url)
    setLinkUrl("")
    setLinkPrompt(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    setUploading(true)
    try {
      // 1. Get a presigned URL from the API
      const presignPath = `/workspaces/${workspaceId}/uploads/presign`
      const { presignedUrl, publicUrl } = await api.post<{
        presignedUrl: string
        publicUrl: string
        key: string
      }>(presignPath, {
        filename: file.name,
        contentType: file.type,
        size: file.size,
      })

      // 2. PUT the file directly to R2
      await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })

      // 3. Insert the public URL into the comment body
      const label = publicUrl || file.name
      setBody((b) => b + (b ? "\n" : "") + label)
    } catch {
      // Fallback: just insert filename so the user knows what happened
      setBody((b) => b + (b ? " " : "") + `[file: ${file.name}]`)
    } finally {
      setUploading(false)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  const filtered =
    filterNodeId === "all"
      ? comments
      : comments.filter((c) => c.nodeId === filterNodeId)

  const nodeOptions = nodes.filter((n) => n.type !== "note")
  const unresolved = filtered.filter((c) => !c.resolved).length

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={BubbleChatAddIcon}
            className="size-4 text-muted-foreground"
          />
          <div>
            <p className="text-sm leading-none font-semibold">Comments</p>
            {unresolved > 0 && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {unresolved} open
              </p>
            )}
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </Button>
      </div>

      {nodeOptions.length > 0 && (
        <div className="no-scrollbar overflow-x-auto border-b border-border">
          <div className="flex min-w-max items-center gap-0.5 px-2 py-1.5">
            <button
              onClick={() => setFilterNodeId("all")}
              className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${filterNodeId === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            {nodeOptions.map((n) => (
              <button
                key={n.id}
                onClick={() => setFilterNodeId(n.id)}
                className={`max-w-[7rem] shrink-0 truncate rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${filterNodeId === n.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {(n.data?.label as string | undefined) ?? n.type}
              </button>
            ))}
          </div>
        </div>
      )}

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
      {/* Comment list */}
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <HugeiconsIcon
              icon={Loading01Icon}
              className="size-4 animate-spin text-muted-foreground"
            />
=======
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-4 text-muted-foreground" />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <HugeiconsIcon
                icon={BubbleChatAddIcon}
                className="size-4 text-muted-foreground"
              />
            </div>
            <p className="mt-1 text-xs font-medium text-foreground">
              No comments yet
            </p>
            <p className="text-[11px] text-muted-foreground">
              Add the first one below
            </p>
          </div>
        ) : (
          filtered.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              depth={0}
              collapsedIds={collapsedIds}
              onToggle={toggleCollapse}
              onResolve={handleResolve}
              onReply={handleReply}
              onReact={handleReact}
              onDelete={handleDelete}
              onPin={handlePin}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
      {/* Compose */}
      <div className="space-y-2 border-t border-border p-3">
        {/* Reply context */}
=======
      <div className="border-t border-border p-3 space-y-2">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
        {replyTo && (
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
            <p className="truncate text-[11px] text-muted-foreground">
              Replying to{" "}
              <span className="font-medium text-foreground">
                {replyTo.userName ?? "comment"}
              </span>
            </p>
            <button onClick={() => setReplyTo(null)} className="ml-2 shrink-0">
              <HugeiconsIcon
                icon={Cancel01Icon}
                className="size-3 text-muted-foreground hover:text-foreground"
              />
            </button>
          </div>
        )}

        {linkPrompt && (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") insertLink()
                if (e.key === "Escape") {
                  setLinkPrompt(false)
                  setLinkUrl("")
                }
              }}
              placeholder="Paste URL and press Enter…"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring/50"
            />
            <button
              onClick={insertLink}
              className="text-[11px] text-primary hover:underline"
            >
              Insert
            </button>
            <button
              onClick={() => {
                setLinkPrompt(false)
                setLinkUrl("")
              }}
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                className="size-3 text-muted-foreground"
              />
            </button>
          </div>
        )}

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={handleFileSelect}
        />
=======
        <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFileSelect} />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit()
              }
=======
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
            }}
            placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
            className="min-h-[56px] resize-none text-xs"
            rows={2}
          />
          <Button
            size="icon-sm"
<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
            onClick={() => void handleSubmit()}
            disabled={!body.trim() || submitting}
            className="shrink-0 self-end"
          >
            <HugeiconsIcon
              icon={submitting ? Loading01Icon : ArrowUp01Icon}
              className={`size-3.5 ${submitting ? "animate-spin" : ""}`}
=======
            onClick={handleSubmit}
            disabled={!body.trim() || submitMutation.isPending}
            className="self-end shrink-0"
          >
            <HugeiconsIcon
              icon={submitMutation.isPending ? Loading01Icon : ArrowUp01Icon}
              className={`size-3.5 ${submitMutation.isPending ? 'animate-spin' : ''}`}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
            />
          </Button>
        </div>

<<<<<<< HEAD:apps/web/components/workflow-builder/comments-panel.tsx
        {/* Attach actions */}
        <div className="-mt-0.5 flex items-center gap-1">
=======
        <div className="flex items-center gap-1 -mt-0.5">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/comments-panel.tsx
          <AttachBar
            onFile={() => !uploading && fileInputRef.current?.click()}
            onLink={() => setLinkPrompt((v) => !v)}
            uploading={uploading}
          />
          <p className="ml-1 text-[10px] text-muted-foreground/50">
            Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  )
}
