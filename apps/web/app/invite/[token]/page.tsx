"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { createApiClient, friendlyApiError } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Skeleton } from "@linea/ui/components/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building04Icon,
  UserAdd01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
=======
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { friendlyApiError } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Skeleton } from '@linea/ui/components/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import { Building04Icon, UserAdd01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

interface InviteDetails {
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  role: string
  email: string | null
  expiresAt: string
}

const ROLE_DESCRIPTION: Record<string, string> = {
  owner: "Full access including billing and workspace deletion",
  admin: "Full access to all resources except billing",
  editor: "Can create, edit, and run workflows",
  viewer: "Read-only access to workflows and executions",
}

export default function InvitePage() {
<<<<<<< HEAD
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { getToken, isSignedIn, isLoaded } = useAuth()

  const [details, setDetails] = useState<InviteDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push(
        `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`
      )
      return
=======
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const getApi = useApiClient();

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    }
  }, [isLoaded, isSignedIn, router]);

<<<<<<< HEAD
    async function fetchDetails() {
      try {
        const authToken = await getToken()
        if (!authToken) return
        const api = createApiClient(authToken)
        const data = await api.get<InviteDetails>(`/invites/${token}`)
        setDetails(data)
      } catch (err) {
        setError(friendlyApiError(err))
      } finally {
        setLoadingDetails(false)
      }
    }

    void fetchDetails()
  }, [isLoaded, isSignedIn, token, getToken, router])

  async function handleAccept() {
    setAccepting(true)
    setError(null)
    try {
      const authToken = await getToken()
      if (!authToken) return
      const api = createApiClient(authToken)
      await api.post(`/invites/${token}/accept`)
      setDone(true)
=======
  const { data: details, isLoading: loadingDetails, error: queryError } = useQuery({
    queryKey: ['invite-details', token],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const api = await getApi();
      return api.get<InviteDetails>(`/invites/${token}`);
    },
    retry: false,
  });
  const error = acceptError ?? (queryError ? friendlyApiError(queryError) : null);

  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const api = await getApi();
      await api.post(`/invites/${token}/accept`);
      setDone(true);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
      // Brief pause then redirect to the workspace
      setTimeout(() => {
        router.push("/pods")
      }, 1500)
    } catch (err) {
<<<<<<< HEAD
      setError(friendlyApiError(err))
=======
      setAcceptError(friendlyApiError(err));
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    } finally {
      setAccepting(false)
    }
  }

  if (!isLoaded || (isSignedIn && loadingDetails)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
<<<<<<< HEAD
        {/* Card */}
        <div className="space-y-6 rounded-xl border bg-background p-8 shadow-sm">
          {/* Icon */}
=======
        <div className="rounded-xl border bg-background p-8 shadow-sm space-y-6">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
          <div className="flex justify-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <HugeiconsIcon
                icon={UserAdd01Icon}
                className="size-7 text-primary"
              />
            </div>
          </div>

          {error ? (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-base font-semibold text-destructive">
                  Invalid invite
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/pods")}
              >
                Go to dashboard
              </Button>
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-base font-semibold text-green-700 dark:text-green-400">
                  Joined!
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You&apos;ve joined{" "}
                  <span className="font-medium text-foreground">
                    {details?.workspaceName}
                  </span>
                  . Redirecting…
                </p>
              </div>
            </div>
          ) : details ? (
            <div className="space-y-6">
              <div className="space-y-1 text-center">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  You&apos;re invited to
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <HugeiconsIcon
                      icon={Building04Icon}
                      className="size-4 text-primary"
                    />
                  </div>
                  <p className="text-lg font-bold">{details.workspaceName}</p>
                </div>
              </div>

              <div className="space-y-1 rounded-lg bg-muted/50 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium capitalize">{details.role}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ROLE_DESCRIPTION[details.role]}
                </p>
              </div>

              {details.email && (
                <p className="text-center text-xs text-muted-foreground">
                  This invite was sent to{" "}
                  <span className="font-medium text-foreground">
                    {details.email}
                  </span>
                </p>
              )}

              <Button
                className="w-full"
                onClick={() => void handleAccept()}
                disabled={accepting}
              >
                {accepting ? (
                  "Joining…"
                ) : (
                  <>
                    Accept invite
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="ml-2 size-4"
                    />
                  </>
                )}
              </Button>

              {error && (
                <p className="text-center text-xs text-destructive">{error}</p>
              )}
            </div>
          ) : null}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Powered by Linea
        </p>
      </div>
    </div>
  )
}
