import type { Metadata } from 'next'
import { Noto_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AIChatbot } from '@/components/ai-chatbot'
import './globals.css'

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: "SIHAT - Seniors' Integrated Health Assessment Tool",
  description: 'SIHAT helps Malaysian elderly understand and manage nutrition and chronic-condition risk factors. Sistem bantuan kesihatan interaktif pintar untuk warga emas Malaysia. 面向马来西亚老年人的智能互动健康辅助与追踪系统。',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <body className={`${notoSans.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
