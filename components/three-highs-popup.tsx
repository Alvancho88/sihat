"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import Image from "next/image"
import { createPortal } from "react-dom"

type LangCode = "en" | "ms" | "zh"

const content = {
  en: {
    title: "Take Charge of Your \"3 Highs\"",
    subtitle: "Knowledge is the first step toward a healthier you.",
    conditions: {
      bloodSugar: {
        name: "High Blood Sugar",
        condition: "Diabetes",
        why: "Over time, it can damage blood vessels and vital organs."
      },
      bloodPressure: {
        name: "High Blood Pressure", 
        condition: "Hypertension",
        why: "Known as the \"silent killer,\" it puts extra strain on your heart."
      },
      cholesterol: {
        name: "High Cholesterol",
        condition: "Hyperlipidemia", 
        why: "Excess fats can clog arteries, affecting blood flow."
      }
    },
    gotIt: "Got it!",
    learnMore: "Learn More",
    doNotShow: "Do not show this again",
    condition: "Condition",
    whatItIs: "What it is",
    whyItMatters: "Why it matters"
  },
  ms: {
    title: "Kawal \"3 Tinggi\" Anda",
    subtitle: "Pengetahuan adalah langkah pertama ke arah kesihatan yang lebih baik.",
    conditions: {
      bloodSugar: {
        name: "Gula Darah Tinggi",
        condition: "Hiper glisemia",
        why: "Dari masa ke masa, ia boleh merosakkan saluran darah dan organ penting."
      },
      bloodPressure: {
        name: "Tekanan Darah Tinggi",
        condition: "Hipertensi", 
        why: "Dikenali sebagai \"pembunuh senyap,\" ia memberikan tekanan tambahan pada jantung anda."
      },
      cholesterol: {
        name: "Kolesterol Tinggi",
        condition: "Hiperlipidemia",
        why: "Lemak berlebihan boleh menyumbat arteri, mempengaruhi aliran darah."
      }
    },
    gotIt: "Faham!",
    learnMore: "Ketahui Lebih Lanjut", 
    doNotShow: "Jangan papar ini lagi",
    condition: "Keadaan",
    whatItIs: "Apa itu",
    whyItMatters: "Mengapa penting"
  },
  zh: {
    title: "掌控您的\"三高\"",
    subtitle: "知识是迈向更健康的第一步。",
    conditions: {
      bloodSugar: {
        name: "高血糖",
        condition: "高血糖症",
        why: "长期来看，它会损害血管和重要器官。"
      },
      bloodPressure: {
        name: "高血压",
        condition: "高血压",
        why: "被称为\"沉默杀手\"，它给心脏带来额外负担。"
      },
      cholesterol: {
        name: "高胆固醇",
        condition: "高脂血症",
        why: "多余的脂肪会堵塞动脉，影响血流。"
      }
    },
    gotIt: "明白了！",
    learnMore: "了解更多",
    doNotShow: "不再显示",
    condition: "状况",
    whatItIs: "到底是什么",
    whyItMatters: "为什么重要"
  }
}

const conditionKeys = ["bloodSugar", "bloodPressure", "cholesterol"] as const
const conditionIcons = {
  bloodSugar: { src: "/images/home-page/blood.png", alt: "Blood sugar icon" },
  bloodPressure: { src: "/images/home-page/heart.png", alt: "Heart icon" },
  cholesterol: { src: "/images/home-page/artery.png", alt: "Artery icon" },
}
export function ThreeHighsPopup({ lang }: { lang: LangCode }) {
  const [isVisible, setIsVisible] = useState(false)
  const [doNotShow, setDoNotShow] = useState(false)
  
  const t = content[lang]

  useEffect(() => {
    // Check if popup has been shown in current session
    const sessionShown = sessionStorage.getItem('3high_popup_shown_session')
    const permanentlyDismissed = localStorage.getItem('dismissed_3high_popup')
    
    if (!sessionShown && !permanentlyDismissed) {
      // Show popup after a short delay to allow page to load
      const timer = setTimeout(() => {
        setIsVisible(true)
        // Mark as shown in current session
        sessionStorage.setItem('3high_popup_shown_session', 'true')
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleGotIt = () => {
    if (doNotShow) {
      localStorage.setItem('dismissed_3high_popup', 'true')
    }
    setIsVisible(false)
    // Session already marked as shown, no need to update
  }

  const handleLearnMore = () => {
    if (doNotShow) {
      localStorage.setItem('dismissed_3high_popup', 'true')
    }
    setIsVisible(false)
    // Session already marked as shown, no need to update
    window.location.href = '/learn'
  }

  if (!isVisible) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[9999] sm:p-4 three-highs-popup">
      <div className="bg-white sm:rounded-2xl rounded-t-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 sm:p-6 sm:pb-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{t.title}</h2>
              <p className="text-sm sm:text-base text-gray-500">{t.subtitle}</p>
            </div>
            <button
              onClick={handleGotIt}
              className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
              aria-label="Close popup"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 sm:p-6 flex-1">

          {/* Mobile: card layout */}
          <div className="flex flex-col gap-3 sm:hidden">
            {conditionKeys.map((key) => {
              const cond = t.conditions[key]
              const icon = conditionIcons[key]
              return (
                <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Image
                      src={icon.src}
                      alt={icon.alt}
                      width={32}
                      height={32}
                      className="object-contain shrink-0"
                    />
                    <span className="font-semibold text-gray-900 text-base">{cond.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide mb-0.5">{t.whatItIs}</p>
                      <p className="text-gray-800">{cond.condition}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide mb-0.5">{t.whyItMatters}</p>
                      <p className="text-gray-800">{cond.why}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">{t.condition}</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">{t.whatItIs}</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">{t.whyItMatters}</th>
                </tr>
              </thead>
              <tbody>
                {conditionKeys.map((key) => {
                  const cond = t.conditions[key]
                  const icon = conditionIcons[key]
                  return (
                    <tr key={key} className="border-b border-gray-100">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Image
                            src={icon.src}
                            alt={icon.alt}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                          <span className="font-medium text-gray-900">{cond.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-700">{cond.condition}</td>
                      <td className="py-4 px-4 text-gray-700">{cond.why}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Checkbox and Actions */}
          <div className="mt-6 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={doNotShow}
                onChange={(e) => setDoNotShow(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm sm:text-base text-gray-700">{t.doNotShow}</span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={handleGotIt}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm sm:text-base"
              >
                {t.gotIt}
              </button>
              <button
                onClick={handleLearnMore}
                className="flex-1 bg-gray-100 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors text-sm sm:text-base"
              >
                {t.learnMore}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
