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
        condition: "Hyperglycemia",
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
    doNotShow: "Do not show this again"
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
    doNotShow: "Jangan papar ini lagi"
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
    doNotShow: "不再显示"
  }
}

export function ThreeHighsPopup({ lang }: { lang: LangCode }) {
  const [isVisible, setIsVisible] = useState(false)
  const [doNotShow, setDoNotShow] = useState(false)
  
  const t = content[lang]

  useEffect(() => {
    // Check if user has dismissed the popup before
    const dismissed = localStorage.getItem('dismissed_3high_popup')
    if (!dismissed) {
      // Show popup after a short delay to allow page to load
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleGotIt = () => {
    if (doNotShow) {
      localStorage.setItem('dismissed_3high_popup', 'true')
    }
    setIsVisible(false)
  }

  const handleLearnMore = () => {
    if (doNotShow) {
      localStorage.setItem('dismissed_3high_popup', 'true')
    }
    setIsVisible(false)
    // TODO: Redirect to learn page or FAQ
    window.location.href = '/learn'
  }

  if (!isVisible) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 three-highs-popup">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.title}</h2>
              <p className="text-lg text-gray-600">{t.subtitle}</p>
            </div>
            <button
              onClick={handleGotIt}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close popup"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Condition</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">What it is</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Why it matters</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Image 
                        src="/images/home-page/blood.png" 
                        alt="Blood sugar icon"
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                      <span className="font-medium text-gray-900">{t.conditions.bloodSugar.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-700">{t.conditions.bloodSugar.condition}</td>
                  <td className="py-4 px-4 text-gray-700">{t.conditions.bloodSugar.why}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Image 
                        src="/images/home-page/heart.png" 
                        alt="Heart icon"
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                      <span className="font-medium text-gray-900">{t.conditions.bloodPressure.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-700">{t.conditions.bloodPressure.condition}</td>
                  <td className="py-4 px-4 text-gray-700">{t.conditions.bloodPressure.why}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Image 
                        src="/images/home-page/artery.png" 
                        alt="Artery icon"
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                      <span className="font-medium text-gray-900">{t.conditions.cholesterol.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-700">{t.conditions.cholesterol.condition}</td>
                  <td className="py-4 px-4 text-gray-700">{t.conditions.cholesterol.why}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Checkbox and Actions */}
          <div className="mt-8 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={doNotShow}
                onChange={(e) => setDoNotShow(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">{t.doNotShow}</span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={handleGotIt}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {t.gotIt}
              </button>
              <button
                onClick={handleLearnMore}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
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
