'use client';

import { useState, useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon, Loading01Icon, CheckmarkCircle01Icon, ArrowUp01Icon,
  BubbleChatAddIcon, SmileIcon, ArrowTurnBackwardIcon, MoreHorizontalIcon,
  Delete01Icon, PinIcon, Link01Icon, Attachment01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Textarea } from '@linea/ui/components/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@linea/ui/components/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@linea/ui/components/dropdown-menu';
import { type Node } from '@xyflow/react';
import { createApiClient } from '@/lib/api';

interface Reaction { emoji: string; count: number; reacted: boolean }
interface Comment {
  id: string; nodeId: string | null; userId: string; userClerkId: string | null;
  userName: string | null; userEmail: string; userAvatarUrl: string | null;
  body: string; resolved: boolean; pinned: boolean; createdAt: string;
  reactions: Reaction[]; replies: Comment[];
}
interface Props {
  token: string; workspaceId: string; podId: string; workflowId: string;
  nodes: Node[]; selectedNodeId?: string | null; currentUserId?: string; onClose: () => void;
}

const BASE_PATH = (ws: string, pod: string, wf: string) =>
  `/workspaces/${ws}/pods/${pod}/workflows/${wf}/comments`;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

// px from reply-item top to the horizontal elbow (= card py-2.5 + half avatar size-5)
const ELBOW_Y = 20;
// px from left of connector column where the vertical line is drawn
const LINE_X = 8;
// width of horizontal elbow arm in px
const ELBOW_W = 12;

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ReactionPicker({ onReact }: { onReact: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Add reaction"
        className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <HugeiconsIcon icon={SmileIcon} className="size-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 z-50 flex gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg">
          {REACTION_EMOJIS.map((e) => (
            <button key={e} onClick={() => { onReact(e); setOpen(false); }}
              className="rounded p-1 text-sm hover:bg-muted transition-colors">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyConnector({
  isLast, elbow = true, isCollapsed, onClick,
}: {
  isLast: boolean; elbow?: boolean; isCollapsed: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? 'Expand replies' : 'Collapse replies'}
      className="group/line relative w-5 shrink-0 self-stretch cursor-pointer"
    >
      <span
        className="absolute w-px rounded-full bg-border/60 group-hover/line:bg-primary/60 transition-colors"
        style={{
          left: LINE_X, top: 0,
          ...(isLast ? { height: ELBOW_Y } : { bottom: 0 }),
        }}
      />
      {elbow && (
        <span
          className="absolute h-px rounded-full bg-border/60 group-hover/line:bg-primary/60 transition-colors"
          style={{ left: LINE_X, top: ELBOW_Y, width: ELBOW_W }}
        />
      )}
    </button>
  );
}

function CommentCard({
  comment, isTopLevel, currentUserId,
  onResolve, onReply, onReact, onDelete, onPin,
}: {
  comment: Comment; isTopLevel: boolean; currentUserId?: string;
  onResolve: (id: string, resolved: boolean) => void;
  onReply: (id: string, userName: string | null) => void;
  onReact: (id: string, emoji: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}) {
  const initials = ((comment.userName ?? comment.userEmail)[0] ?? '?').toUpperCase();
  const visibleReactions = comment.reactions.filter((r) => r.count > 0);
  const isOwner = !!currentUserId && currentUserId === comment.userClerkId;

  return (
    <div className={`group rounded-lg border border-border px-3 py-2.5 space-y-1.5 transition-opacity ${comment.resolved ? 'opacity-40' : ''} ${comment.pinned ? 'border-primary/30 bg-primary/5' : ''}`}>
      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar className="size-5 shrink-0">
            {comment.userAvatarUrl && <AvatarImage src={comment.userAvatarUrl} />}
            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium truncate max-w-[7rem]">
            {comment.userName ?? comment.userEmail.split('@')[0]}
          </span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgo(comment.createdAt)}</span>
          {comment.pinned && (
            <span className="text-[10px] text-primary/60 font-medium shrink-0">pinned</span>
          )}
        </div>

        {/* Resolve + more menu */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {isTopLevel && (
            <button
              onClick={() => onResolve(comment.id, !comment.resolved)}
              title={comment.resolved ? 'Reopen' : 'Resolve'}
              className={`rounded p-1 transition-colors ${
                comment.resolved ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'
              }`}
            >
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onPin(comment.id, !comment.pinned)}>
                <HugeiconsIcon icon={PinIcon} className="size-3.5 text-muted-foreground" />
                {comment.pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReply(comment.id, comment.userName)}>
                <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5 text-muted-foreground" />
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

      {/* Body */}
      <p className="text-xs leading-relaxed text-foreground/90">{comment.body}</p>

      {/* Reactions + quick actions */}
      <div className="flex items-center gap-1 flex-wrap">
        {visibleReactions.map((r) => (
          <button
            key={r.emoji}
            onClick={() => onReact(comment.id, r.emoji)}
            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
              r.reacted
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted/30 hover:bg-muted text-foreground/80'
            }`}
          >
            <span>{r.emoji}</span>
            <span className="font-medium">{r.count}</span>
          </button>
        ))}

        {/* Quick action icons — appear on hover */}
        <div className="ml-auto flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <ReactionPicker onReact={(e) => onReact(comment.id, e)} />
          <button
            onClick={() => onReply(comment.id, comment.userName)}
            title="Reply"
            className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// When collapsed: hides ALL replies and shows an expand pill.
// This gives a clear visual signal regardless of reply count.
function CommentThread({
  comment, depth, collapsedIds, onToggle,
  onResolve, onReply, onReact, onDelete, onPin, currentUserId,
}: {
  comment: Comment; depth: number; collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onReply: (id: string, userName: string | null) => void;
  onReact: (id: string, emoji: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  currentUserId?: string;
}) {
  const replies = comment.replies;
  const hasReplies = replies.length > 0;
  const isCollapsed = hasReplies && collapsedIds.has(comment.id);
  const toggleThis = () => onToggle(comment.id);
  const sharedProps = { onResolve, onReply, onReact, onDelete, onPin, currentUserId };

  return (
    <div>
      <CommentCard comment={comment} isTopLevel={depth === 0} {...sharedProps} />

      {hasReplies && (
        <div className="ml-2.5">
          {/* Bridge from parent card to reply block */}
          <div className="relative h-1.5">
            <span
              className="absolute w-px bg-border/50"
              style={{ left: LINE_X, top: 0, bottom: 0 }}
            />
          </div>

          {isCollapsed ? (
            /* ── Collapsed: show expand pill connected to line ── */
            <div className="flex items-center">
              <button
                onClick={toggleThis}
                className="group/line relative w-5 shrink-0 self-stretch cursor-pointer"
                title="Expand replies"
              >
                {/* Short vertical stub to the pill */}
                <span
                  className="absolute w-px rounded-full bg-border/60 group-hover/line:bg-primary/60 transition-colors"
                  style={{ left: LINE_X, top: 0, height: 16 }}
                />
                {/* Horizontal arm */}
                <span
                  className="absolute h-px rounded-full bg-border/60 group-hover/line:bg-primary/60 transition-colors"
                  style={{ left: LINE_X, top: 16, width: ELBOW_W }}
                />
              </button>
              <button
                onClick={toggleThis}
                className="flex-1 text-left text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
              >
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'} — click to expand
              </button>
            </div>
          ) : (
            /* ── Expanded: all replies with tree connectors ── */
            replies.map((reply, idx) => {
              const isLast = idx === replies.length - 1;
              return (
                <div key={reply.id} className="flex">
                  <ReplyConnector isLast={isLast} isCollapsed={isCollapsed} onClick={toggleThis} />
                  <div className="flex-1 min-w-0 pb-1.5">
                    <CommentThread
                      comment={reply}
                      depth={depth + 1}
                      collapsedIds={collapsedIds}
                      onToggle={onToggle}
                      {...sharedProps}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function AttachBar({
  onLink, onFile, uploading,
}: {
  onLink: () => void;
  onFile: () => void;
  uploading?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onFile}
        disabled={uploading}
        title={uploading ? 'Uploading…' : 'Attach file'}
        className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <HugeiconsIcon
          icon={uploading ? Loading01Icon : Attachment01Icon}
          className={`size-3.5 ${uploading ? 'animate-spin' : ''}`}
        />
      </button>
      <button
        onClick={onLink}
        title="Attach link"
        className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <HugeiconsIcon icon={Link01Icon} className="size-3.5" />
      </button>
    </div>
  );
}

export function CommentsPanel({ token, workspaceId, podId, workflowId, nodes, selectedNodeId, currentUserId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterNodeId, setFilterNodeId] = useState<string | 'all'>('all');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [linkPrompt, setLinkPrompt] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const api = createApiClient(token);
  const path = BASE_PATH(workspaceId, podId, workflowId);

  useEffect(() => {
    if (selectedNodeId) setFilterNodeId(selectedNodeId);
  }, [selectedNodeId]);

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Comment[]>(path);
      const normalise = (c: Comment): Comment => ({
        ...c,
        reactions: c.reactions ?? [],
        replies: (c.replies ?? []).map(normalise),
      });
      setComments((data ?? []).map(normalise));
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await api.post(path, {
        body: trimmed,
        nodeId: filterNodeId !== 'all' ? filterNodeId : null,
        parentId: replyTo?.id ?? undefined,
      });
      setBody('');
      setReplyTo(null);
      await load();
    } catch { /* endpoint may not exist yet */ } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(id: string, resolved: boolean) {
    try {
      await api.patch(`${path}/${id}`, { resolved });
      const toggle = (c: Comment): Comment =>
        c.id === id ? { ...c, resolved } : { ...c, replies: c.replies.map(toggle) };
      setComments((prev) => prev.map(toggle));
    } catch { /* silently ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`${path}/${id}`);
      const remove = (list: Comment[]): Comment[] =>
        list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: remove(c.replies) }));
      setComments((prev) => remove(prev));
    } catch { /* silently ignore */ }
  }

  async function handlePin(id: string, pinned: boolean) {
    try {
      await api.patch(`${path}/${id}`, { pinned });
      const toggle = (c: Comment): Comment =>
        c.id === id ? { ...c, pinned } : { ...c, replies: c.replies.map(toggle) };
      setComments((prev) => prev.map(toggle));
    } catch { /* silently ignore — pin may not be supported yet */ }
  }

  async function handleReact(commentId: string, emoji: string) {
    try {
      await api.post(`${path}/${commentId}/react`, { emoji });
      const update = (c: Comment): Comment => {
        if (c.id === commentId) {
          const existing = c.reactions.find((r) => r.emoji === emoji);
          const reactions = existing
            ? c.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
                  : r
              )
            : [...c.reactions, { emoji, count: 1, reacted: true }];
          return { ...c, reactions };
        }
        return { ...c, replies: c.replies.map(update) };
      };
      setComments((prev) => prev.map(update));
    } catch { /* silently ignore */ }
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
    } catch {
      // Fallback: just insert filename so the user knows what happened
      setBody((b) => b + (b ? ' ' : '') + `[file: ${file.name}]`);
    } finally {
      setUploading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  const filtered = filterNodeId === 'all'
    ? comments
    : comments.filter((c) => c.nodeId === filterNodeId);

  const nodeOptions = nodes.filter((n) => n.type !== 'note');
  const unresolved = filtered.filter((c) => !c.resolved).length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={BubbleChatAddIcon} className="size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold leading-none">Comments</p>
            {unresolved > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{unresolved} open</p>
            )}
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </Button>
      </div>

      {/* Node filter */}
      {nodeOptions.length > 0 && (
        <div className="no-scrollbar overflow-x-auto border-b border-border">
          <div className="flex items-center gap-0.5 px-2 py-1.5 min-w-max">
            <button
              onClick={() => setFilterNodeId('all')}
              className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${filterNodeId === 'all' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All
            </button>
            {nodeOptions.map((n) => (
              <button
                key={n.id}
                onClick={() => setFilterNodeId(n.id)}
                className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors max-w-[7rem] truncate ${filterNodeId === n.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {(n.data?.label as string | undefined) ?? n.type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <HugeiconsIcon icon={Loading01Icon} className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-1.5 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <HugeiconsIcon icon={BubbleChatAddIcon} className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-foreground mt-1">No comments yet</p>
            <p className="text-[11px] text-muted-foreground">Add the first one below</p>
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

      {/* Compose */}
      <div className="border-t border-border p-3 space-y-2">
        {/* Reply context */}
        {replyTo && (
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
            <p className="text-[11px] text-muted-foreground truncate">
              Replying to{' '}
              <span className="font-medium text-foreground">{replyTo.userName ?? 'comment'}</span>
            </p>
            <button onClick={() => setReplyTo(null)} className="shrink-0 ml-2">
              <HugeiconsIcon icon={Cancel01Icon} className="size-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}

        {/* Link input */}
        {linkPrompt && (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') insertLink();
                if (e.key === 'Escape') { setLinkPrompt(false); setLinkUrl(''); }
              }}
              placeholder="Paste URL and press Enter…"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring/50"
            />
            <button onClick={insertLink} className="text-[11px] text-primary hover:underline">
              Insert
            </button>
            <button onClick={() => { setLinkPrompt(false); setLinkUrl(''); }}>
              <HugeiconsIcon icon={Cancel01Icon} className="size-3 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFileSelect} />

        {/* Textarea + send */}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit(); }
            }}
            placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
            className="min-h-[56px] resize-none text-xs"
            rows={2}
          />
          <Button
            size="icon-sm"
            onClick={() => void handleSubmit()}
            disabled={!body.trim() || submitting}
            className="self-end shrink-0"
          >
            <HugeiconsIcon
              icon={submitting ? Loading01Icon : ArrowUp01Icon}
              className={`size-3.5 ${submitting ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>

        {/* Attach actions */}
        <div className="flex items-center gap-1 -mt-0.5">
          <AttachBar
            onFile={() => !uploading && fileInputRef.current?.click()}
            onLink={() => setLinkPrompt((v) => !v)}
            uploading={uploading}
          />
          <p className="text-[10px] text-muted-foreground/50 ml-1">Shift+Enter for newline</p>
        </div>
      </div>
    </div>
  );
}
