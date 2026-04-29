"use client"
import { useState, useEffect, type ReactNode } from "react"
import { Navbar } from "@/components/navbar"
import { AIChatbot } from "@/components/ai-chatbot"

type LangCode = "en" | "ms" | "zh"

// Persist language preference
const useLangPersistence = () => {
  const [lang, setLang] = useState<LangCode>("en")
  
  useEffect(() => {
    const saved = (localStorage.getItem("sihat-lang") || localStorage.getItem("manis-lang")) as LangCode
    if (saved && ["en", "ms", "zh"].includes(saved)) {
      setLang(saved)
    }
  }, [])

  const updateLang = (newLang: LangCode) => {
    setLang(newLang)
    localStorage.setItem("sihat-lang", newLang)
  }

  return [lang, updateLang] as const
}

export function PageLayout({ children }: { children: (lang: LangCode) => ReactNode }) {
  const [lang, setLang] = useLangPersistence()
  return (
    <div className="min-h-screen bg-background">
      <Navbar lang={lang} setLang={setLang} />
      <main className="overflow-x-clip">{children(lang)}</main>
      <footer className="bg-primary border-t-2 border-primary-foreground/20 mt-16 py-8 px-4 text-center text-primary-foreground">
        <p className="font-bold text-lg mb-1">SIHAT - Seniors' Integrated Health Assessment Tool</p>
        <p className="text-primary-foreground/80">
          {lang === "en" && "Information for general awareness only. Please consult a doctor for medical advice."}
          {lang === "ms" && "Maklumat untuk kesedaran umum sahaja. Sila rujuk doktor untuk nasihat perubatan."}
          {lang === "zh" && "仅供一般意识参考。请咨询医生获取医疗建议。"}
        </p>
        {/* <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
          <span>
            {lang === "en" && "Feedback? Contact us: "}
            {lang === "ms" && "Maklum balas? Hubungi kami: "}
            {lang === "zh" && "反馈？联系我们："}
            <a href="mailto:SIHAT_FIT5120@outlook.com" className="text-primary-foreground hover:underline font-bold">MANIS_FIT5120@outlook.com</a>
          </span>
          <span className="hidden sm:inline text-primary-foreground/40">|</span>
          <a 
            href="https://kalori-api.my/search" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary-foreground hover:underline font-bold"
          >
            {lang === "en" && "Food Database Source"}
            {lang === "ms" && "Sumber Pangkalan Data Makanan"}
            {lang === "zh" && "食物数据库来源"}
          </a>
        </div> */}
        <p className="mt-3 text-sm text-primary-foreground/70">© 2026 SIHAT</p>
      </footer>
      {/* AI Chatbot */}
      {/* <AIChatbot lang={lang} /> */}
    </div>
  )
}
