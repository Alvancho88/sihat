// Component for the "Scan a menu" call-to-action card that appears in the menu and recommendation pages. 
// It has three variants: "statistics", "learn", and "default". Each variant has different text content, but they all share the same layout and styling. 
// The component also supports three languages: English (en), Malay (ms), and Chinese (zh).
"use client"

import Link from "next/link"
import { ClipboardList } from "lucide-react"

// The text content for each variant and language
const variants = {
  statistics: {
    en: {
      eyebrow: "Start your journey",
      heading: "Knowledge is step one. Action is step two.",
      body: "You've seen the numbers. Now take the first step — scan a restaurant menu and discover healthier choices that work for you.",
      cta: "Scan a menu →",
    },
    ms: {
      eyebrow: "Mulakan perjalanan anda",
      heading: "Ilmu adalah langkah pertama. Tindakan adalah langkah kedua.",
      body: "Anda telah melihat angka-angkanya. Kini ambil langkah pertama — imbas menu restoran dan temui pilihan yang lebih sihat untuk anda.",
      cta: "Imbas menu →",
    },
    zh: {
      eyebrow: "开始您的旅程",
      heading: "知识是第一步，行动是第二步。",
      body: "您已经了解了数据。现在迈出第一步——扫描餐厅菜单，发现适合您的更健康选择。",
      cta: "扫描菜单 →",
    },
  },

  learn: {
    en: {
      eyebrow: "Put it into practice",
      heading: "Ready to eat smarter when dining out?",
      body: "Scan any restaurant menu and get personalised suggestions on what to order, based on what you just learned.",
      cta: "Try menu scan →",
    },
    ms: {
      eyebrow: "Amalkan ilmu anda",
      heading: "Bersedia untuk makan lebih bijak semasa makan di luar?",
      body: "Imbas mana-mana menu restoran dan dapatkan cadangan peribadi tentang apa yang perlu dipesan — berdasarkan apa yang anda baru pelajari.",
      cta: "Cuba imbas menu →",
    },
    zh: {
      eyebrow: "学以致用",
      heading: "准备好在外出就餐时吃得更聪明了吗？",
      body: "扫描任何餐厅菜单，根据您刚刚学到的知识获取个性化的点餐建议。",
      cta: "试试菜单扫描 →",
    },
  },

  default: {
    en: {
      eyebrow: "Take action",
      heading: "Not sure what to order?",
      body: "Scan any restaurant menu and get personalised suggestions on what to eat — based on your health needs.",
      cta: "Scan a menu →",
    },
    ms: {
      eyebrow: "Ambil tindakan",
      heading: "Tidak pasti apa yang hendak dipesan?",
      body: "Imbas mana-mana menu restoran dan dapatkan cadangan peribadi tentang apa yang perlu dimakan — berdasarkan keperluan kesihatan anda.",
      cta: "Imbas menu →",
    },
    zh: {
      eyebrow: "采取行动",
      heading: "不确定该点什么？",
      body: "扫描任何餐厅菜单，根据您的健康需求获取个性化的饮食建议。",
      cta: "扫描菜单 →",
    },
  },
} as const

export type MenuScanVariant = keyof typeof variants

interface MenuScanCTAProps {
  lang: "en" | "ms" | "zh"
  variant?: MenuScanVariant
}

export function MenuScanCTA({ lang, variant = "default" }: MenuScanCTAProps) {
  const t = variants[variant][lang]
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-base font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {t.eyebrow}
      </p>
      <div className="flex items-center gap-4 sm:gap-5">
        {/* Icon */}
        <div
          className="shrink-0 flex items-center justify-center rounded-2xl w-14 h-14"
          style={{ backgroundColor: "#e1f4f5" }}
        >
          <ClipboardList className="w-7 h-7" style={{ color: "#0f586e" }} />
        </div>

        {/* Text + button */}
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-foreground leading-snug mb-1">{t.heading}</p>
          <p className="text-base text-muted-foreground leading-snug hidden sm:block">{t.body}</p>
        </div>

        {/* Button: hidden on mobile, visible on sm+ */}
        <Link
          href="/recommendation"
          className="shrink-0 hidden sm:inline-flex items-center justify-center rounded-full px-5 py-2.5 text-base font-semibold transition-colors"
          style={{ backgroundColor: "#1d759e", color: "#E1F5EE" }}
        >
          {t.cta}
        </Link>
      </div>

      {/* Body text + button stacked on mobile */}
      <div className="mt-3 sm:hidden">
        <p className="text-base text-muted-foreground leading-snug mb-3">{t.body}</p>
        <Link
          href="/recommendation"
          className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-base font-semibold transition-colors"
          style={{ backgroundColor: "#1d759e", color: "#E1F5EE" }}
        >
          {t.cta}
        </Link>
      </div>
    </div>
  )
}
