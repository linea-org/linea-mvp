"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { usePod } from "@/contexts/space-context"
import { createApiClient } from "@/lib/api"
import { Dialog, DialogContent, DialogTitle } from "@linea/ui/components/dialog"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  WorkflowSquare01Icon,
  LayoutLeftIcon,
  FlowCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  AiBrain01Icon,
  LinkSquare01Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons"

type Step = "welcome" | "pod" | "template" | "ready"

interface StarterTemplate {
  id: string
  name: string
  description: string
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  accent: string
  definition: {
    nodes: Array<{
      id: string
      type: string
      position: { x: number; y: number }
      data: Record<string, unknown>
    }>
    edges: Array<{ id: string; source: string; target: string; type?: string }>
  }
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "ai-assistant",
    name: "AI Assistant",
    description: "A simple agent that responds to user messages.",
    icon: AiBrain01Icon,
    accent:
      "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20",
    definition: {
      nodes: [
        {
          id: "s1",
          type: "start",
          position: { x: 80, y: 180 },
          data: { nodeName: "Start", label: "Start" },
        },
        {
          id: "a1",
          type: "agent",
          position: { x: 320, y: 180 },
          data: {
            nodeName: "AI Agent",
            label: "AI Agent",
            systemPrompt: "You are a helpful assistant.",
          },
        },
        {
          id: "e1",
          type: "end",
          position: { x: 560, y: 180 },
          data: { nodeName: "End", label: "End" },
        },
      ],
      edges: [
        { id: "e1", source: "s1", target: "a1" },
        { id: "e2", source: "a1", target: "e1" },
      ],
    },
  },
  {
    id: "data-pipeline",
    name: "Data Pipeline",
    description: "Fetch from an API and transform the result.",
    icon: LinkSquare01Icon,
    accent:
      "border-purple-200 bg-purple-50/60 dark:border-purple-900 dark:bg-purple-950/20",
    definition: {
      nodes: [
        {
          id: "s1",
          type: "start",
          position: { x: 80, y: 180 },
          data: { nodeName: "Start", label: "Start" },
        },
        {
          id: "h1",
          type: "http",
          position: { x: 300, y: 180 },
          data: {
            nodeName: "Fetch Data",
            label: "Fetch Data",
            method: "GET",
            url: "",
          },
        },
        {
          id: "t1",
          type: "transform",
          position: { x: 540, y: 180 },
          data: { nodeName: "Transform", label: "Transform" },
        },
        {
          id: "e1",
          type: "end",
          position: { x: 780, y: 180 },
          data: { nodeName: "End", label: "End" },
        },
      ],
      edges: [
        { id: "e1", source: "s1", target: "h1" },
        { id: "e2", source: "h1", target: "t1" },
        { id: "e3", source: "t1", target: "e1" },
      ],
    },
  },
  {
    id: "approval-flow",
    name: "Approval Flow",
    description: "Agent output reviewed by a human before proceeding.",
    icon: CheckmarkCircle01Icon,
    accent:
      "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20",
    definition: {
      nodes: [
        {
          id: "s1",
          type: "start",
          position: { x: 80, y: 180 },
          data: { nodeName: "Start", label: "Start" },
        },
        {
          id: "a1",
          type: "agent",
          position: { x: 300, y: 180 },
          data: {
            nodeName: "Draft",
            label: "Draft",
            systemPrompt: "Draft a response for human review.",
          },
        },
        {
          id: "ap1",
          type: "approval",
          position: { x: 540, y: 180 },
          data: { nodeName: "Review", label: "Review" },
        },
        {
          id: "e1",
          type: "end",
          position: { x: 780, y: 180 },
          data: { nodeName: "End", label: "End" },
        },
      ],
      edges: [
        { id: "e1", source: "s1", target: "a1" },
        { id: "e2", source: "a1", target: "ap1" },
        { id: "e3", source: "ap1", target: "e1" },
      ],
    },
  },
  {
    id: "multi-step",
    name: "Multi-step Agent",
    description: "Two chained agents for complex reasoning tasks.",
    icon: Layers01Icon,
    accent:
      "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20",
    definition: {
      nodes: [
        {
          id: "s1",
          type: "start",
          position: { x: 80, y: 180 },
          data: { nodeName: "Start", label: "Start" },
        },
        {
          id: "a1",
          type: "agent",
          position: { x: 300, y: 180 },
          data: {
            nodeName: "Research",
            label: "Research",
            systemPrompt: "Research the given topic and summarise key points.",
          },
        },
        {
          id: "a2",
          type: "agent",
          position: { x: 540, y: 180 },
          data: {
            nodeName: "Synthesise",
            label: "Synthesise",
            systemPrompt: "Using the research, produce a clear final answer.",
          },
        },
        {
          id: "e1",
          type: "end",
          position: { x: 780, y: 180 },
          data: { nodeName: "End", label: "End" },
        },
      ],
      edges: [
        { id: "e1", source: "s1", target: "a1" },
        { id: "e2", source: "a1", target: "a2" },
        { id: "e3", source: "a2", target: "e1" },
      ],
    },
  },
]

export function WelcomeModal() {
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const { pods, loading: podLoading, reload: reloadPods } = usePod()
  const { getToken } = useAuth()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("welcome")
  const [podName, setPodName] = useState("")
  const [creating, setCreating] = useState(false)
  const [createdPodId, setCreatedPodId] = useState<string | null>(null)
  const [createdWorkflowId, setCreatedWorkflowId] = useState<string | null>(
    null
  )
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  useEffect(() => {
    if (wsLoading || podLoading) return
    if (!activeWorkspace || pods.length > 0) return

    async function checkOnboarded() {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const me = await api.get<{ onboardedAt: string | null }>("/users/me")
      if (!me.onboardedAt) setOpen(true)
    }

    void checkOnboarded()
  }, [wsLoading, podLoading, pods.length, activeWorkspace, getToken])

  async function markOnboarded() {
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    await api.post("/users/me/complete-onboarding", {})
  }

  function dismiss() {
    void markOnboarded()
    setOpen(false)
  }

  async function handleCreatePod() {
    if (!activeWorkspace || !podName.trim()) return
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const pod = await api.post<{ id: string; name: string }>(
        `/workspaces/${activeWorkspace.id}/pods`,
        { name: podName.trim() }
      )
      setCreatedPodId(pod.id)
      void reloadPods()
      void markOnboarded()
      localStorage.setItem("linea_gs_pod", "true")
      setStep("template")
    } finally {
      setCreating(false)
    }
  }

  async function handleSelectTemplate(template: StarterTemplate) {
    if (!activeWorkspace || !createdPodId) return
    setCreatingTemplate(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const wf = await api.post<{ id: string }>(
        `/workspaces/${activeWorkspace.id}/pods/${createdPodId}/workflows`,
        { name: template.name, definition: template.definition }
      )
      setCreatedWorkflowId(wf.id)
    } catch {
      // silently skip — user can still create workflows manually
    } finally {
      setCreatingTemplate(false)
      setStep("ready")
    }
  }

  function handleGoToBuilder() {
    if (createdPodId) {
      if (createdWorkflowId) {
        router.push(`/pods/${createdPodId}/workflows/${createdWorkflowId}`)
      } else {
        router.push(`/pods/${createdPodId}/workflows`)
      }
    }
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) dismiss()
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Welcome to Linea</DialogTitle>
        {step === "welcome" && (
          <WelcomeStep onNext={() => setStep("pod")} onSkip={dismiss} />
        )}
        {step === "pod" && (
          <PodStep
            value={podName}
            onChange={setPodName}
            onSubmit={handleCreatePod}
            loading={creating}
            onSkip={dismiss}
          />
        )}
        {step === "template" && (
          <TemplateStep
            loading={creatingTemplate}
            onSelect={handleSelectTemplate}
            onSkip={() => setStep("ready")}
          />
        )}
        {step === "ready" && (
          <ReadyStep
            hasTemplate={!!createdWorkflowId}
            onGo={handleGoToBuilder}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function WelcomeStep({
  onNext,
  onSkip,
}: {
  onNext: () => void
  onSkip: () => void
}) {
  return (
    <div className="flex flex-col">
      <div className="border-b bg-gradient-to-br from-primary/10 via-primary/5 to-background px-8 py-10 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <HugeiconsIcon
            icon={WorkflowSquare01Icon}
            className="size-7 text-primary"
          />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome to Linea</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Build, deploy, and run AI agent workflows — from simple automations to
          complex multi-step pipelines.
        </p>
      </div>

      <div className="space-y-4 px-8 py-6">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          How it works
        </p>
        <div className="space-y-4">
          {[
            {
              icon: LayoutLeftIcon,
              title: "Create a pod",
              desc: "A pod is your project — it groups your workflows, schedules, and execution history.",
            },
            {
              icon: WorkflowSquare01Icon,
              title: "Build a workflow",
              desc: "Drag and drop AI agent nodes onto the canvas and connect them together.",
            },
            {
              icon: FlowCircleIcon,
              title: "Run and monitor",
              desc: "Trigger via API, schedule, webhook, or run manually. Watch live execution status.",
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <HugeiconsIcon
                  icon={icon}
                  className="size-4 text-muted-foreground"
                />
              </div>
              <div>
                <p className="text-sm leading-snug font-medium">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-8 py-4">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip setup
        </button>
        <Button onClick={onNext}>
          Get started
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function PodStep({
  value,
  onChange,
  onSubmit,
  loading,
  onSkip,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => Promise<void>
  loading: boolean
  onSkip: () => void
}) {
  return (
    <div className="flex flex-col">
      <div className="border-b px-8 pt-8 pb-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <HugeiconsIcon
            icon={LayoutLeftIcon}
            className="size-5 text-muted-foreground"
          />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Create your first pod</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pods keep your workflows, schedules, and executions organised. You can
          always create more later.
        </p>
      </div>

      <div className="px-8 py-6">
        <div className="space-y-1.5">
          <Label htmlFor="onboarding-pod-name">Pod name</Label>
          <Input
            id="onboarding-pod-name"
            placeholder="e.g. Production, Research, Sales"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) void onSubmit()
            }}
            autoFocus
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-8 py-4">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip for now
        </button>
        <Button
          onClick={() => void onSubmit()}
          disabled={!value.trim() || loading}
        >
          {loading ? "Creating…" : "Create pod"}
          {!loading && (
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

function TemplateStep({
  loading,
  onSelect,
  onSkip,
}: {
  loading: boolean
  onSelect: (t: StarterTemplate) => Promise<void>
  onSkip: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="flex flex-col">
      <div className="border-b px-8 pt-8 pb-5">
        <h2 className="text-lg font-semibold">Start with a template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a starter workflow to open in the builder, or start from scratch.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 py-5">
        {STARTER_TEMPLATES.map((t) => (
          <button
            key={t.id}
            disabled={loading}
            onClick={() => {
              setSelected(t.id)
              void onSelect(t)
            }}
            className={`relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:shadow-sm focus:outline-none disabled:opacity-60 ${t.accent} ${selected === t.id ? "ring-2 ring-primary" : ""}`}
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-background/80">
              <HugeiconsIcon icon={t.icon} className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm leading-snug font-semibold">{t.name}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {t.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-t px-8 py-4">
        <button
          onClick={onSkip}
          disabled={loading}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          Start from scratch
        </button>
        {loading && (
          <p className="animate-pulse text-xs text-muted-foreground">
            Setting up…
          </p>
        )}
      </div>
    </div>
  )
}

function ReadyStep({
  hasTemplate,
  onGo,
}: {
  hasTemplate: boolean
  onGo: () => void
}) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          className="size-7 text-emerald-500"
        />
      </div>
      <h2 className="text-xl font-bold">You&apos;re all set!</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {hasTemplate
          ? "Your starter workflow is ready. Open the builder to customise it."
          : "Your pod is ready. Open the workflow builder to create your first automation."}
      </p>
      <Button className="mt-6" onClick={onGo}>
        Open workflow builder
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
      </Button>
    </div>
  )
}
