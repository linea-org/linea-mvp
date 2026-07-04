"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Skeleton } from "@linea/ui/components/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Loading01Icon,
  Alert01Icon,
  Clock01Icon,
  ArrowRight01Icon,
  FlowCircleIcon,
  ReloadIcon,
  Archive02Icon,
} from "@hugeicons/core-free-icons"

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  read: boolean
  createdAt: string
  resourceUrl?: string | null
}

type TypeFilter = "all" | "execution" | "approval" | "schedule" | "system"

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "execution", label: "Executions" },
  { key: "approval", label: "Approvals" },
  { key: "schedule", label: "Scheduled" },
  { key: "system", label: "System" },
]

function matchesType(n: Notification, f: TypeFilter) {
  if (f === "all") return true
  if (f === "execution")
    return /execution|fail|complet|success|run/i.test(n.type)
  if (f === "approval") return /approval|suspend|interrupt/i.test(n.type)
  if (f === "schedule") return /schedul|trigger|cron/i.test(n.type)
  if (f === "system")
    return !/execution|fail|complet|success|run|approval|suspend|interrupt|schedul|trigger|cron/i.test(
      n.type
    )
  return true
}

function notifConfig(type: string) {
  if (/fail|error/i.test(type))
    return {
      icon: Cancel01Icon,
      border: "border-l-destructive",
      dot: "bg-destructive",
    }
  if (/complet|success/i.test(type))
    return {
      icon: CheckmarkCircle01Icon,
      border: "border-l-green-500",
      dot: "bg-green-500",
    }
  if (/approval|suspend/i.test(type))
    return {
      icon: Alert01Icon,
      border: "border-l-amber-500",
      dot: "bg-amber-500",
    }
  if (/schedul|trigger|cron/i.test(type))
    return {
      icon: Clock01Icon,
      border: "border-l-blue-500",
      dot: "bg-blue-500",
    }
  if (/run|execution/i.test(type))
    return {
      icon: FlowCircleIcon,
      border: "border-l-violet-500",
      dot: "bg-violet-500",
    }
  return {
    icon: Archive02Icon,
    border: "border-l-border",
    dot: "bg-muted-foreground",
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function ActionButtons({
  n,
  onMarkRead,
  onDismiss,
}: {
  n: Notification
  onMarkRead: () => void
  onDismiss: () => void
}) {
  const isApproval = /approval|suspend/i.test(n.type)
  const isFailed = /fail|error/i.test(n.type)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {n.resourceUrl && (
        <Link
          href={n.resourceUrl}
          onClick={onMarkRead}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
        >
          View
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        </Link>
      )}
      {isApproval && n.resourceUrl && (
        <>
          <Link
            href={n.resourceUrl}
            onClick={onMarkRead}
            className="flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400"
          >
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
            Approve
          </Link>
          <Link
            href={n.resourceUrl}
            onClick={onMarkRead}
            className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
            Reject
          </Link>
        </>
      )}
      {isFailed && n.resourceUrl && (
        <Link
          href={n.resourceUrl}
          onClick={onMarkRead}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <HugeiconsIcon icon={ReloadIcon} className="size-3" />
          Retry
        </Link>
      )}
      {!n.read && (
        <button
          onClick={onMarkRead}
          className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Mark read
        </button>
      )}
      <button
        onClick={onDismiss}
        className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
      >
        Dismiss
      </button>
    </div>
  )
}

export default function NotificationsPage() {
  const { getToken } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [readFilter, setReadFilter] = useState<"all" | "unread">("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")

  async function load() {
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const data = await api.get<Notification[]>("/notifications")
      setNotifications(data ?? [])
    } catch {
      // endpoint may not be available yet
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function markAllRead() {
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.patch("/notifications/read-all")
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      /* ignore */
    }
  }

  async function markRead(id: string) {
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.patch(`/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch {
      /* ignore */
    }
  }

  async function dismiss(id: string) {
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.delete(`/notifications/${id}`)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      /* ignore */
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  let items = notifications
  if (readFilter === "unread") items = items.filter((n) => !n.read)
  items = items.filter((n) => matchesType(n, typeFilter))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void markAllRead()}
          >
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Read filter */}
        <div className="flex gap-4">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setReadFilter(t)}
              className={`pb-0 text-sm font-medium capitalize transition-colors ${readFilter === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "all"
                ? `All (${notifications.length})`
                : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>
        {/* Type filter */}
        <div className="flex items-center gap-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${typeFilter === f.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon
              icon={Archive02Icon}
              className="size-5 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium">
            {readFilter === "unread"
              ? "No unread notifications"
              : notifications.length === 0
                ? "No notifications yet"
                : "No matches"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {notifications.length === 0
              ? "Workflow events will appear here."
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const cfg = notifConfig(n.type)
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 rounded-lg border border-l-4 ${cfg.border} px-4 py-3.5 ${!n.read ? "bg-muted/10" : "bg-background"} transition-colors`}
              >
                <div
                  className={`mt-1 size-2 shrink-0 rounded-full ${!n.read ? cfg.dot : "bg-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm leading-snug ${!n.read ? "font-medium text-foreground" : "text-foreground/80"}`}
                    >
                      {n.title}
                    </p>
                    <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                      {n.body}
                    </p>
                  )}
                  <ActionButtons
                    n={n}
                    onMarkRead={() => void markRead(n.id)}
                    onDismiss={() => void dismiss(n.id)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
