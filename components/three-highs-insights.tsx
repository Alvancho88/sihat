// This component is used in the insights section of the statistics page. 
// It displays three cards with information about the relationship between diabetes, blood pressure, and cholesterol. 
// The content is localized in English, Malay, and Chinese.
"use client"

import { Heart, Activity, Smile, ArrowRight } from "lucide-react"
import Link from "next/link"

// The text content for each language
const content = {
  en: {
    eyebrow: "Did you know",
    heading: "The three highs rarely travel alone",
    cards: [
      {
        tag: "Diabetes + Blood pressure",
        accent: "#378ADD",
        iconBg: "#E6F1FB",
        iconColor: "#185FA5",
        body: "High blood sugar quietly damages blood vessel walls over time. This forces your heart to work harder, which is why 1 in 3 people with diabetes also develop high blood pressure.",
      },
      {
        tag: "Diabetes + Cholesterol",
        accent: "#D85A30",
        iconBg: "#FAECE7",
        iconColor: "#993C1D",
        body: "Diabetes changes how the body processes fats. Even without a change in diet, it can cause cholesterol to build up in the bloodstream, silently raising the risk of heart disease.",
      },
      {
        tag: "Good news",
        accent: "#1D9E75",
        iconBg: "#E1F5EE",
        iconColor: "#0F6E56",
        body: "Managing one condition helps the others too. Eating better and moving more can lower blood sugar, reduce blood pressure, and improve cholesterol all at the same time.",
        cta: { label: "Check the nutritional value of your food", href: "/food" },
      },
    ],
  },
  ms: {
    eyebrow: "Tahukah anda",
    heading: "Tiga penyakit tinggi jarang datang bersendirian",
    cards: [
      {
        tag: "Diabetes + Tekanan darah",
        accent: "#378ADD",
        iconBg: "#E6F1FB",
        iconColor: "#185FA5",
        body: "Gula darah tinggi secara senyap merosakkan dinding saluran darah dari masa ke masa. Ini memaksa jantung bekerja lebih keras — itulah sebabnya 1 daripada 3 orang dengan diabetes juga menghidap tekanan darah tinggi.",
      },
      {
        tag: "Diabetes + Kolesterol",
        accent: "#D85A30",
        iconBg: "#FAECE7",
        iconColor: "#993C1D",
        body: "Diabetes mengubah cara badan memproses lemak. Walaupun tanpa perubahan diet, ia boleh menyebabkan kolesterol terkumpul dalam aliran darah — secara senyap meningkatkan risiko penyakit jantung.",
      },
      {
        tag: "Berita baik",
        accent: "#1D9E75",
        iconBg: "#E1F5EE",
        iconColor: "#0F6E56",
        body: "Mengurus satu keadaan membantu yang lain juga. Makan lebih baik dan bergerak lebih banyak boleh menurunkan gula darah, mengurangkan tekanan darah, dan meningkatkan kolesterol — semuanya pada masa yang sama.",
        cta: { label: "Semak nilai nutrisi makanan anda", href: "/food" },
      },
    ],
  },
  zh: {
    eyebrow: "你知道吗",
    heading: "三高很少单独出现",
    cards: [
      {
        tag: "糖尿病 + 血压",
        accent: "#378ADD",
        iconBg: "#E6F1FB",
        iconColor: "#185FA5",
        body: "长期高血糖会悄悄损伤血管壁，迫使心脏更努力工作。这就是为什么每3位糖尿病患者中就有1位同时患有高血压。",
      },
      {
        tag: "糖尿病 + 胆固醇",
        accent: "#D85A30",
        iconBg: "#FAECE7",
        iconColor: "#993C1D",
        body: "糖尿病会改变身体处理脂肪的方式。即使饮食没有变化，也可能导致胆固醇在血液中积聚——悄悄增加心脏病的风险。",
      },
      {
        tag: "好消息",
        accent: "#1D9E75",
        iconBg: "#E1F5EE",
        iconColor: "#0F6E56",
        body: "控制一种疾病也有助于其他疾病。改善饮食和增加运动可以同时降低血糖、降低血压并改善胆固醇水平。",
        cta: { label: "检查您的食物的营养价值", href: "/food" },
      },
    ],
  },
}

const ICONS = [Heart, Activity, Smile]

export function ThreeHighsInsights({ lang }: { lang: "en" | "ms" | "zh" }) {
  const t = content[lang]
  return (
    <section>
      {/* Eyebrow + heading */ }
      <p className="text-base font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {t.eyebrow}
      </p>
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-balance">
        {t.heading}
      </h2>

      {/* Cards grid */ }
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {t.cards.map((card, i) => {
          const Icon = ICONS[i]
          return (
            <div
              key={i}
              className="relative overflow-hidden rounded-2xl border border-border bg-background flex flex-col gap-3 p-4 sm:p-5"
              style={{ borderTop: `3px solid ${card.accent}` }}
            >
              {/* Tag row */}
              <div className="flex items-center gap-2">
                <div
                  className="shrink-0 flex items-center justify-center rounded-full w-7 h-7"
                  style={{ backgroundColor: card.iconBg }}
                >
                  <Icon className="w-6 h-6" style={{ color: card.iconColor }} />
                </div>
                <span
                  className="text-lg font-semibold rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: card.iconBg, color: card.iconColor }}
                >
                  {card.tag}
                </span>
              </div>

              {/* Body */}
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                {card.body}
              </p>

              {/* CTA — only shown on cards that have one (i.e. Good news) */}
              {"cta" in card && card.cta && (
                <Link
                  href={card.cta.href}
                  className="mt-auto flex items-center gap-1.5 text-base font-semibold"
                  style={{ color: card.iconColor }}
                >
                  {card.cta.label} <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
