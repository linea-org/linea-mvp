'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';

export default function GeneralSettingsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name);
      setSlug(activeWorkspace.slug);
    }
  }, [activeWorkspace]);

  async function handleSave() {
    if (!activeWorkspace) return;
    setSaving(true);
    setSaved(false);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(`/workspaces/${activeWorkspace.id}`, { name, slug });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (wsLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-slug">Slug</Label>
          <Input
            id="ws-slug"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSaved(false); }}
          />
          <p className="text-xs text-muted-foreground">Used in URLs. Only lowercase letters, numbers, and hyphens.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <p className="text-sm text-green-600">Saved!</p>}
      </div>
    </div>
  );
}
