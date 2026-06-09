import type { Metadata } from 'next';
import { Geist_Mono, Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"

export const metadata: Metadata = {
  title: {
    default: 'Linea',
    template: '%s — Linea',
  },
  description: 'AI workflow automation platform. Build, run, and monitor intelligent workflows.',
  metadataBase: new URL('https://linea.build'),
  openGraph: {
    title: 'Linea',
    description: 'AI workflow automation platform.',
    siteName: 'Linea',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Linea',
    description: 'AI workflow automation platform.',
  },
};

import "@linea/ui/globals.css"
import "driver.js/dist/driver.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ReactQueryProvider } from "@/components/providers"
import { Toaster } from "@linea/ui/components/sonner"
import { cn } from "@linea/ui/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
      >
        <body>
          <ReactQueryProvider>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </ReactQueryProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
