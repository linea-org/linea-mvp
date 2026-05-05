'use client';

import { useState } from 'react';
import { Button } from '@linea/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@linea/ui/components/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  MoreHorizontalIcon,
  CopyLinkIcon,
  Copy01Icon,
  Tick02Icon,
  ClaudeIcon,
} from '@hugeicons/core-free-icons';

interface Props {
  slug: string[];
  title: string;
}

export function PageActions({ slug, title }: Props) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const copyMarkdown = async () => {
    const res = await fetch(`/api/docs/raw/${slug.join('/')}`);
    if (!res.ok) return;
    await navigator.clipboard.writeText(await res.text());
    setMdCopied(true);
    setTimeout(() => setMdCopied(false), 2000);
  };

  const openInClaude = () => {
    const q = `Help me understand this Linea documentation page: ${title}\n${window.location.href}`;
    window.open(`https://claude.ai/new?q=${encodeURIComponent(q)}`, '_blank', 'noopener');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          className="shrink-0 text-muted-foreground"
          aria-label="Page actions"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={copyLink}>
          <HugeiconsIcon
            icon={linkCopied ? Tick02Icon : CopyLinkIcon}
            strokeWidth={2}
            className={linkCopied ? 'text-emerald-500' : ''}
          />
          {linkCopied ? 'Link copied!' : 'Copy link'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyMarkdown}>
          <HugeiconsIcon
            icon={mdCopied ? Tick02Icon : Copy01Icon}
            strokeWidth={2}
            className={mdCopied ? 'text-emerald-500' : ''}
          />
          {mdCopied ? 'Markdown copied!' : 'Copy Markdown'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openInClaude}>
          <HugeiconsIcon icon={ClaudeIcon} strokeWidth={2} />
          Open in Claude
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
