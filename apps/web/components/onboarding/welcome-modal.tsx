'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { usePod } from '@/contexts/space-context';
import { createApiClient } from '@/lib/api';
import { Dialog, DialogContent } from '@linea/ui/components/dialog';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  LayoutLeftIcon,
  FlowCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons';

const STORAGE_KEY = 'linea_onboarded';

type Step = 'welcome' | 'pod' | 'ready';

export function WelcomeModal() {
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const { pods, loading: podLoading, reload: reloadPods } = usePod();
  const { getToken } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const [podName, setPodName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdPodId, setCreatedPodId] = useState<string | null>(null);

  useEffect(() => {
    if (wsLoading || podLoading) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (activeWorkspace && pods.length === 0) {
      setOpen(true);
    }
  }, [wsLoading, podLoading, pods.length, activeWorkspace]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  }

  async function handleCreatePod() {
    if (!activeWorkspace || !podName.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const pod = await api.post<{ id: string; name: string }>(
        `/workspaces/${activeWorkspace.id}/pods`,
        { name: podName.trim() },
      );
      setCreatedPodId(pod.id);
      void reloadPods();
      localStorage.setItem(STORAGE_KEY, 'true');
      localStorage.setItem('linea_gs_pod', 'true');
      setStep('ready');
    } finally {
      setCreating(false);
    }
  }

  function handleGoToBuilder() {
    if (createdPodId) router.push(`/pods/${createdPodId}/workflows`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
        {step === 'welcome' && (
          <WelcomeStep onNext={() => setStep('pod')} onSkip={dismiss} />
        )}
        {step === 'pod' && (
          <PodStep
            value={podName}
            onChange={setPodName}
            onSubmit={handleCreatePod}
            loading={creating}
            onSkip={dismiss}
          />
        )}
        {step === 'ready' && (
          <ReadyStep onGo={handleGoToBuilder} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background px-8 py-10 text-center border-b">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome to Linea</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
          Build, deploy, and run AI agent workflows — from simple automations to complex multi-step pipelines.
        </p>
      </div>

      <div className="px-8 py-6 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          How it works
        </p>
        <div className="space-y-4">
          {[
            {
              icon: LayoutLeftIcon,
              title: 'Create a pod',
              desc: 'A pod is your project — it groups your workflows, schedules, and execution history.',
            },
            {
              icon: WorkflowSquare01Icon,
              title: 'Build a workflow',
              desc: 'Drag and drop AI agent nodes onto the canvas and connect them together.',
            },
            {
              icon: FlowCircleIcon,
              title: 'Run and monitor',
              desc: 'Trigger via API, schedule, webhook, or run manually. Watch live execution status.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <HugeiconsIcon icon={icon} className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium leading-snug">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-8 py-4">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip setup
        </button>
        <Button onClick={onNext}>
          Get started
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PodStep({
  value,
  onChange,
  onSubmit,
  loading,
  onSkip,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => Promise<void>;
  loading: boolean;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-8 pt-8 pb-6 border-b">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <HugeiconsIcon icon={LayoutLeftIcon} className="size-5 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Create your first pod</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pods keep your workflows, schedules, and executions organised. You can always create more later.
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
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading) void onSubmit(); }}
            autoFocus
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-8 py-4">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
        <Button onClick={() => void onSubmit()} disabled={!value.trim() || loading}>
          {loading ? 'Creating…' : 'Create pod'}
          {!loading && <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function ReadyStep({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-4">
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-7 text-emerald-500" />
      </div>
      <h2 className="text-xl font-bold">You&apos;re all set!</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">
        Your pod is ready. Open the workflow builder to create your first automation.
      </p>
      <Button className="mt-6" onClick={onGo}>
        Open workflow builder
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
      </Button>
    </div>
  );
}
