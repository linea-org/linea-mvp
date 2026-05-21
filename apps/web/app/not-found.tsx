import Link from 'next/link';
import { Button } from '@linea/ui/components/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-2">
        <p className="text-5xl font-bold text-muted-foreground/30">404</p>
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          This page doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/">Go to dashboard</Link>
      </Button>
    </div>
  );
}
