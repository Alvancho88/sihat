"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Home, BookOpen, Utensils, Search, MapPin, Menu, X, Globe, Camera, ChartNoAxesCombined } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", icon: Home, label: { en: "Home", ms: "Laman Utama", zh: "首页" } },
  //{ href: "/recommendation", icon: Camera, label: { en: "Recommendation", ms: "Cadangan", zh: "推荐" } },
  //{ href: "/recommendation", icon: Camera, label: { en: "Recommendation", ms: "Cadangan", zh: "推荐" } },
  { href: "/food", icon: Utensils, label: { en: "Food", ms: "Makanan", zh: "食物" } },
  { href: "/statistics", icon: ChartNoAxesCombined, label: { en: "Statistics", ms: "Statistik", zh: "统计数据" } },
  { href: "/learn", icon: BookOpen, label: { en: "Learn", ms: "Belajar", zh: "学习" } },
  //{ href: "/healthcare", icon: MapPin, label: { en: "Healthcare", ms: "Klinik", zh: "医疗" } },
]

const languages = [
  { code: "en", label: "English" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "zh", label: "中文" },
]

type LangCode = "en" | "ms" | "zh"

export function Navbar({ lang = "en", setLang }: { lang?: LangCode; setLang?: (l: LangCode) => void }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  const t = (item: { en: string; ms: string; zh: string }) => item[lang]

  return (
    <header className="sticky top-0 z-60 bg-background border-b-2 border-primary/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <Image 
              src="/images/sihat-logo.png" 
              alt="SIHAT Logo" 
              width={72} 
              height={72} 
              className="w-14 h-14 md:w-16 md:h-16"
            />
            <span className="text-primary font-extrabold text-2xl md:text-3xl">SIHAT</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 min-w-[90px] px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-6 h-6 shrink-0" />
                  <span className="whitespace-nowrap text-sm">{t(item.label)}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language selector */}
            { <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-primary/30 text-base font-bold hover:bg-muted transition-colors bg-card text-foreground"
                aria-label="Select Language"
              >
                <Globe className="w-5 h-5 text-primary" />
                <span>{lang === "en" ? "EN" : lang === "ms" ? "BM" : "中文"}</span>
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 min-w-[140px]">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLang?.(l.code as LangCode)
                        setLangOpen(false)
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 text-base hover:bg-muted transition-colors",
                        lang === l.code && "bg-primary/10 text-primary font-semibold"
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div> }

            {/* Mobile menu toggle */}
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors text-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle Menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-card px-4 pb-4">
          <nav className="grid grid-cols-3 gap-2 pt-3">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-sm font-medium transition-colors text-center",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-primary/10"
                  )}
                >
                  <item.icon className="w-6 h-6 shrink-0" />
                  <span className="text-xs leading-tight line-clamp-2">{t(item.label)}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}
