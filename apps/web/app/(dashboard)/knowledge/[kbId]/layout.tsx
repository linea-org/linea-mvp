import type { Metadata } from "next"

export const metadata: Metadata = { title: "Knowledge Base" }

export default function KbDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
