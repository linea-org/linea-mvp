import type { Metadata } from "next"

export const metadata: Metadata = { title: "Pods" }

export default function PodsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
