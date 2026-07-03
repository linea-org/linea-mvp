import { redirect } from "next/navigation"

// Both app/page.tsx and app/(dashboard)/page.tsx claim '/', causing a conflict.
// The actual home page lives at app/(dashboard)/home/page.tsx (/home).
export default function RootStub() {
  redirect("/home")
}
