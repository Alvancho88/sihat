"use client"

import { useState, useEffect, useRef } from "react"
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps"
import { AlertCircle, X } from "lucide-react"

export interface StateMapData {
  patients: number  
  diabetes: number 
  hypertension: number
  hyperlipidemia: number
}

// { "Selangor": { patients, prevalence, population }, ... }
export type YearMapData = Record<string, StateMapData>

export interface ChoroplethMapProps {
  dataByYear: Record<string, YearMapData>
  availableYears: string[]
  lang: string
  t: {
    map_title: string
    map_subtitle: string
    select_year: string
    legend_high: string
    legend_medium: string
    legend_low: string
    click_state: string
    highest_rate: string
    lowest_rate: string
    average_rate: string
    disclaimer_text_map: string
  }
}

const MALAYSIA_GEO_URL = "/data/malaysia.geojson"

const getStateName = (geoName: string): string => geoName

// Colour thresholds based on prevalence % (replaces old getColorByPatients)
const getColorByPrevalence = (prevalence: number): string => {
  if (prevalence > 14) return "#1a3a6b"
  if (prevalence > 7) return "#4a7fc1"
  return "#c9dff5"
}

const getRisk = (prevalence: number): "high" | "medium" | "low" => {
  if (prevalence > 14) return "high"
  if (prevalence > 7) return "medium"
  return "low"
}

// State name translation
const stateNameTranslations: Record<string, { en: string; ms: string; zh: string }> = {
  "Johor": { en: "Johor", ms: "Johor", zh: "柔佛" },
  "Kedah": { en: "Kedah", ms: "Kedah", zh: "吉打" },
  "Kelantan": { en: "Kelantan", ms: "Kelantan", zh: "吉兰丹" },
  "Melaka": { en: "Malacca", ms: "Melaka", zh: "马六甲" },
  "Negeri Sembilan": { en: "Negeri Sembilan", ms: "Negeri Sembilan", zh: "森美兰" },
  "Pahang": { en: "Pahang", ms: "Pahang", zh: "彭亨" },
  "Perak": { en: "Perak", ms: "Perak", zh: "霹雳" },
  "Perlis": { en: "Perlis", ms: "Perlis", zh: "玻璃市" },
  "Pulau Pinang": { en: "Penang", ms: "Pulau Pinang", zh: "槟城" },
  "Sabah": { en: "Sabah", ms: "Sabah", zh: "沙巴" },
  "Sarawak": { en: "Sarawak", ms: "Sarawak", zh: "砂拉越" },
  "Selangor": { en: "Selangor", ms: "Selangor", zh: "雪兰莪" },
  "Terengganu": { en: "Terengganu", ms: "Terengganu", zh: "登嘉楼" },
  "WP Kuala Lumpur": { en: "Kuala Lumpur", ms: "WP Kuala Lumpur", zh: "吉隆坡" },
  "WP Labuan": { en: "Labuan", ms: "WP Labuan", zh: "纳闽" },
  "WP Putrajaya": { en: "Putrajaya", ms: "WP Putrajaya", zh: "布城" },
};

const getStateNameTranslated = (geoName: string, lang: "en" | "ms" | "zh"): string => {
  const state = stateNameTranslations[geoName]
  return state ? state[lang] : geoName
}

// ─── State panel messages ──────────────────────────────────────────────────
// Each risk level gets a message covering all three highs with actionable steps.
// The message is dynamic — it references the actual state data values so the
// advice reflects what that state's numbers actually show.
function buildStateMessage(
  risk: "high" | "medium" | "low",
  d: StateMapData,
  lang: "en" | "ms" | "zh",
): { why: string; actions: string[] } {
  if (lang === "ms") {
    if (risk === "high") return {
      why: `Negeri ini mempunyai kadar diabetes yang tinggi pada ${d.diabetes.toFixed(1)}%, dengan tekanan darah tinggi pada ${d.hypertension.toFixed(1)}% dan kolesterol tinggi pada ${d.hyperlipidemia.toFixed(1)}% dalam kalangan penduduk dewasa. Ketiga-tiga keadaan ini sering berlaku bersama dan meningkatkan risiko penyakit jantung dan strok secara serentak.`,
      actions: [
        "Lakukan saringan gula darah, tekanan darah dan kolesterol sekurang-kurangnya sekali setahun — terutama jika anda berumur 40 tahun ke atas.",
        "Kurangkan makanan manis, makanan bergoreng dan makanan yang mengandungi garam tinggi untuk membantu ketiga-tiga keadaan ini.",
        "Berjalan kaki 30 minit sehari boleh membantu menurunkan gula darah dan tekanan darah pada masa yang sama.",
      ],
    }
    if (risk === "medium") return {
      why: `Negeri ini mempunyai kadar diabetes yang sederhana pada ${d.diabetes.toFixed(1)}%, dengan tekanan darah tinggi pada ${d.hypertension.toFixed(1)}% dan kolesterol tinggi pada ${d.hyperlipidemia.toFixed(1)}%. Ini bermakna kira-kira 1 dalam 10 orang dewasa terjejas oleh diabetes — dan ramai yang mungkin tidak tahu mereka berisiko.`,
      actions: [
        "Dapatkan saringan gula darah jika anda belum melakukannya dalam tempoh 12 bulan yang lalu.",
        "Tukarkan minuman manis dengan air kosong atau teh o kosong untuk mengurangkan pengambilan gula.",
        "Semak tekanan darah anda secara percuma di mana-mana klinik kerajaan atau farmasi.",
      ],
    }
    return {
      why: `Negeri ini mempunyai kadar diabetes yang agak rendah pada ${d.diabetes.toFixed(1)}%, tetapi tekanan darah tinggi pada ${d.hypertension.toFixed(1)}% dan kolesterol tinggi pada ${d.hyperlipidemia.toFixed(1)}% masih membimbangkan. Angka yang lebih rendah bukan bermakna tiada risiko — ia hanya bermakna ada lebih banyak masa untuk mengambil langkah pencegahan.`,
      actions: [
        "Kekalkan tahap gula darah yang sihat dengan makan makanan seimbang menggunakan kaedah pinggan Suku-Suku-Separuh.",
        "Periksa tekanan darah anda secara berkala — tekanan darah tinggi sering tiada gejala.",
        "Kekal aktif dengan aktiviti ringan seperti berjalan kaki, berkebun atau senam ringan setiap hari.",
      ],
    }
  }

  if (lang === "zh") {
    if (risk === "high") return {
      why: `该州糖尿病患病率高达 ${d.diabetes.toFixed(1)}%，高血压患病率为 ${d.hypertension.toFixed(1)}%，高胆固醇患病率为 ${d.hyperlipidemia.toFixed(1)}%。这三种疾病往往同时出现，大幅增加心脏病和中风的风险。`,
      actions: [
        "每年至少进行一次血糖、血压和胆固醇检查，尤其是40岁以上人士。",
        "减少甜食、油炸食品和高盐食物的摄入，有助于同时控制这三种疾病。",
        "每天步行30分钟可同时帮助降低血糖和血压。",
      ],
    }
    if (risk === "medium") return {
      why: `该州糖尿病患病率为 ${d.diabetes.toFixed(1)}%，高血压患病率为 ${d.hypertension.toFixed(1)}%，高胆固醇患病率为 ${d.hyperlipidemia.toFixed(1)}%。约每10名成年人中就有1人患有糖尿病，且许多人可能尚不知道自己面临风险。`,
      actions: [
        "如果您在过去12个月内未做过检查，请进行血糖筛查。",
        "将含糖饮料换成白开水或无糖茶，以减少糖分摄入。",
        "前往任何政府诊所或药房免费测量血压。",
      ],
    }
    return {
      why: `该州糖尿病患病率相对较低，为 ${d.diabetes.toFixed(1)}%，但高血压（${d.hypertension.toFixed(1)}%）和高胆固醇（${d.hyperlipidemia.toFixed(1)}%）仍需关注。较低的数字并不意味着没有风险，而是意味着还有更多时间采取预防措施。`,
      actions: [
        "使用\"四分之一谷物、四分之一蛋白质、半盘蔬菜\"的饮食方法保持健康血糖水平。",
        "定期测量血压——高血压通常没有明显症状。",
        "每天进行散步、园艺或轻度体操等轻度活动，保持积极的生活方式。",
      ],
    }
  }

  // English (default)
  if (risk === "high") return {
    why: `This state has a high diabetes rate of ${d.diabetes.toFixed(1)}%, alongside hypertension at ${d.hypertension.toFixed(1)}% and high cholesterol at ${d.hyperlipidemia.toFixed(1)}%. These three conditions often occur together and significantly raise the risk of heart disease and stroke.`,
    actions: [
      "Get your blood sugar, blood pressure, and cholesterol checked at least once a year — especially if you are over 40.",
      "Cut back on sweet foods, fried foods, and high-salt meals to help manage all three conditions at once.",
      "A 30-minute daily walk can lower blood sugar and blood pressure at the same time.",
    ],
  }
  if (risk === "medium") return {
    why: `This state has a moderate diabetes rate of ${d.diabetes.toFixed(1)}%, with hypertension at ${d.hypertension.toFixed(1)}% and high cholesterol at ${d.hyperlipidemia.toFixed(1)}%. Around 1 in 10 adults are affected by diabetes — and many may not know they are at risk.`,
    actions: [
      "Get a blood sugar screening if you haven't had one in the last 12 months.",
      "Swap sugary drinks for plain water or unsweetened tea to reduce your sugar intake.",
      "Check your blood pressure for free at any government clinic or pharmacy.",
    ],
  }
  return {
    why: `This state has a relatively low diabetes rate of ${d.diabetes.toFixed(1)}%, but hypertension at ${d.hypertension.toFixed(1)}% and high cholesterol at ${d.hyperlipidemia.toFixed(1)}% are still worth watching. Lower numbers don't mean no risk — they mean there's still time to act preventively.`,
    actions: [
      "Keep blood sugar in check by eating balanced meals using the Quarter-Quarter-Half plate method.",
      "Check your blood pressure regularly — high blood pressure often has no symptoms.",
      "Stay active with light daily activities like walking, gardening, or gentle stretching.",
    ],
  }
}

export function MalaysiaChoroplethMap({ dataByYear, availableYears, lang, t }: ChoroplethMapProps) {
  const [selectedYear, setSelectedYear] = useState(availableYears[availableYears.length - 1] ?? "")
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 109, y: 4.2 })
  const [mapError, setMapError] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const [containerWidth, setContainerWidth] = useState(800)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ name: string; prevalence: number; x: number; y: number } | null>(null)

  const baseScale = Math.max(containerWidth * 4, 2000)

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
        setZoom(1)
        setPosition({ x: 109, y: 4.2 })
      }
    })
    if (mapContainerRef.current) observer.observe(mapContainerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    fetch(MALAYSIA_GEO_URL)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load map")
        setMapLoading(false)
      })
      .catch(err => {
        console.error("Map fetch error:", err)
        setMapError(true)
        setMapLoading(false)
      })
  }, [])

  // scroll to state details when a state is selected
  useEffect(() => {
    if (selectedState) {
      const timer = setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [selectedState]);

  const stateData = dataByYear[selectedYear] ?? {}

  const handleStateClick = (geo: any) => {
    const name = getStateName(geo.properties.name)
    if (stateData[name]) setSelectedState(prev => (prev === name ? null : name))
  }

  const stateEntries = Object.entries(stateData)
  const highestState = stateEntries.length ? stateEntries.reduce((a, b) => a[1].diabetes > b[1].diabetes ? a : b) : null
  const lowestState  = stateEntries.length ? stateEntries.reduce((a, b) => a[1].diabetes < b[1].diabetes ? a : b) : null

  const labels = ({
    en: { diabetes: "Diabetes", hypertension: "Hypertension", hyperlipidemia: "Hyperlipidemia", patients: "Total Patients", risk: "Prevalence Level" },
    ms: { diabetes: "Diabetes", hypertension: "Hipertensi", hyperlipidemia: "Hiperlipidemia", patients: "Jumlah Pesakit", risk: "Tahap Prevalens" },
    zh: { diabetes: "糖尿病", hypertension: "高血压", hyperlipidemia: "高胆固醇", patients: "总患者数", risk: "患病率等级" },
  } as const)[lang as "en" | "ms" | "zh"] ?? { diabetes: "Diabetes", hypertension: "Hypertension", hyperlipidemia: "Hyperlipidemia", patients: "Total Patients", risk: "Prevalence Level" }

  const riskLabels = ({
    en: { high: "High",   medium: "Medium",    low: "Low" },
    ms: { high: "Tinggi", medium: "Sederhana", low: "Rendah" },
    zh: { high: "高",     medium: "中等",       low: "低" },
  } as const)[lang as "en" | "ms" | "zh"] ?? { high: "High", medium: "Medium", low: "Low" }

  const tapForMore = lang === "ms" ? "Ketik untuk butiran"
    : lang === "zh" ? "点击查看详情"
    : "Tap for details"

  const whatYouCanDo = lang === "ms" ? "Apa yang boleh anda lakukan"
    : lang === "zh" ? "您可以做什么"
    : "What you can do"

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-sm">
      <h2 className="text-2xl sm:text-3xl font-bold mb-1">{t.map_title}</h2>
      <p className="text-lg text-muted-foreground mb-4">{t.map_subtitle}</p>

      {/* Data clarity pill */}
      <div className="inline-flex items-center gap-2 bg-muted/60 border border-border rounded-full px-4 py-1.5 mb-4">
        <span className="text-base">🗺️</span>
        <p className="text-base font-medium text-muted-foreground">
          {lang === "ms"
            ? "Warna peta menunjukkan prevalens diabetes. Ketik mana-mana negeri untuk melihat data tekanan darah dan kolesterol juga."
            : lang === "zh"
            ? "地图颜色显示糖尿病患病率。点击任何州属查看血压和胆固醇数据。"
            : "Map colour shows diabetes prevalence. Tap any state to see blood pressure and cholesterol data too."}
        </p>
      </div>

      {/* Year selector */}
      <div className="mb-4">
        <p className="text-base font-semibold mb-2">{t.select_year}:</p>
        <div className="flex flex-wrap gap-2">
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => { setSelectedYear(year); setSelectedState(null) }}
              className={`px-5 py-3 rounded-xl text-lg font-bold transition-all ${
                selectedYear === year
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/80 border border-border"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {[
          { color: "#c9dff5", border: "#7aaed6", label: t.legend_low },
          { color: "#4a7fc1", border: "#2f5f9e", label: t.legend_medium },
          { color: "#1a3a6b", border: "#0f2147", label: t.legend_high },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2 text-sm sm:text-base">
            <div className="w-5 h-5 rounded border-2" style={{ background: l.color, borderColor: l.border }} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>

      <p className="text-lg text-foreground mb-3">{t.click_state}</p>

      {/* Map canvas */}
      <div
        ref={mapContainerRef}
        className="relative w-full h-[350px] md:aspect-[16/9] min-h-[200px] bg-[#edf0f5] rounded-xl overflow-hidden"
        onMouseLeave={() => setTooltip(null)}
      >
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          {[
            { label: "+", action: () => setZoom(z => Math.min(z + 0.2, 8)) },
            { label: "−", action: () => setZoom(z => Math.max(z - 0.2, 0.5)) },
            { label: "⊙", action: () => { setZoom(1); setPosition({ x: 109, y: 4.2 }) } },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              className="w-9 h-9 bg-white border border-border rounded-lg shadow flex items-center justify-center text-lg font-bold hover:bg-muted"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#f8fafc]">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-base text-muted-foreground">
                {lang === "ms" ? "Memuatkan peta..." : lang === "zh" ? "加载地图中..." : "Loading map..."}
              </p>
            </div>
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#f8fafc]">
            <div className="text-center p-6">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-base text-muted-foreground">
                {lang === "ms" ? "Tidak dapat memuatkan peta. Data masih tersedia di bawah."
                  : lang === "zh" ? "无法加载地图。数据仍可在下方查看。"
                  : "Unable to load map. Data is still available below."}
              </p>
            </div>
          </div>
        )}

        {!mapError && (
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: baseScale, center: [109, 4.5] }}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup
              zoom={zoom}
              center={[position.x, position.y]}
              onMoveEnd={({ zoom: newZoom, coordinates }) => {
                setZoom(newZoom)
                setPosition({ x: coordinates[0], y: coordinates[1] })
              }}
              minZoom={0.5}
              maxZoom={8}
            >
              <Geographies geography={MALAYSIA_GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const name = getStateName(geo.properties.name)
                    const data = stateData[name]
                    const isSelected = selectedState === name
                    const fillColor = data ? getColorByPrevalence(data.diabetes) : "#e5e7eb"
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isSelected ? "#f59e0b" : fillColor}
                        stroke="#ffffff"
                        strokeWidth={1}
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "#f59e0b", outline: "none", cursor: "pointer" },
                          pressed: { fill: "#d97706", outline: "none" },
                        }}
                        onMouseEnter={(evt) => {
                          if (data) {
                            const rect = mapContainerRef.current?.getBoundingClientRect()
                            if (rect) {
                              setTooltip({
                                name: getStateNameTranslated(name, lang as "en" | "ms" | "zh"),
                                prevalence: data.diabetes,
                                x: evt.clientX - rect.left,
                                y: evt.clientY - rect.top,
                              })
                            }
                          }
                        }}
                        onMouseMove={(evt) => {
                          if (data) {
                            const rect = mapContainerRef.current?.getBoundingClientRect()
                            if (rect) {
                              setTooltip(prev => prev ? { ...prev, x: evt.clientX - rect.left, y: evt.clientY - rect.top } : null)
                            }
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => handleStateClick(geo)}
                      />
                    )
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        )}

        {/* Hover tooltip — shows diabetes % + hint to tap for more */}
        {tooltip && (
          <div
            className="absolute z-20 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-lg font-medium"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 40,
              transform: tooltip.x > containerWidth - 120 ? "translateX(-110%)" : undefined,
            }}
          >
            <p className="font-bold text-gray-800">{tooltip.name}</p>
            <p className="text-gray-600">{tooltip.prevalence.toFixed(1)}%</p>
            <p className="text-gray-600 text-base mt-0.5">{tapForMore}</p>
          </div>
        )}
      </div>

      {/* Selected state detail panel */}
      {selectedState && stateData[selectedState] && (() => {
        const d = stateData[selectedState]
        const risk = getRisk(d.diabetes)
        const safeLang = (lang === "ms" || lang === "zh") ? lang : "en"
        const { why, actions } = buildStateMessage(risk, d, safeLang)

        const riskConfig = {
          high:   { bg: "#1a3a6b", light: "#f6f7f9", emoji: "⚠️" },
          medium: { bg: "#4a7fc1", light: "#f6f7f9", emoji: "ℹ️" },
          low:    { bg: "#7aaed6", light: "#f6f7f9", emoji: "✅" },
        }
        const config = riskConfig[risk]

        return (
          <div ref={detailsRef} className="mt-4 rounded-2xl overflow-hidden shadow-md border-2">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: config.bg }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{config.emoji}</span>
                <div>
                  <p className="text-white text-sm font-medium uppercase tracking-wider opacity-80">
                    {labels.risk}: {riskLabels[risk]}
                  </p>
                  <h3 className="text-white text-xl font-bold leading-tight">{getStateNameTranslated(selectedState, lang as "en" | "ms" | "zh")}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedState(null)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Stats row — all three highs + patients */}
            <div
              className="grid max-[425px]:grid-cols-1 grid-cols-2 sm:grid-cols-3 divide-x divide-gray-200"
              style={{ backgroundColor: config.light }}
            >
              <div className="px-5 py-3 text-center">
                <p className="text-base text-gray-500 font-medium uppercase tracking-wide mb-1">{labels.diabetes}</p>
                <p className="text-3xl font-bold" style={{ color: "#1a3a6b" }}>{d.diabetes.toFixed(1)}%</p>
              </div>
              <div className="px-5 py-3 text-center">
                <p className="text-base text-gray-500 font-medium uppercase tracking-wide mb-1">{labels.hypertension}</p>
                <p className="text-3xl font-bold" style={{ color: "#1a3a6b" }}>{d.hypertension.toFixed(1)}%</p>
              </div>
              <div className="px-5 py-3 text-center">
                <p className="text-base text-gray-500 font-medium uppercase tracking-wide mb-1">{labels.hyperlipidemia}</p>
                <p className="text-3xl font-bold" style={{ color: "#1a3a6b" }}>{d.hyperlipidemia.toFixed(1)}%</p>
              </div>
              <div className="px-5 py-3 text-center sm:col-start-2 sm:border-t border-gray-200">
                <p className="text-base text-gray-500 font-medium uppercase tracking-wide mb-1">{labels.patients}</p>
                <p className="text-3xl font-bold" style={{ color: "#1a3a6b" }}>{d.patients.toLocaleString()}</p>
              </div>
            </div>

            {/* Why — context paragraph */}
            <div className="px-5 pt-4 pb-2" style={{ backgroundColor: config.light }}>
              <p className="text-lg text-gray-700 leading-relaxed">{why}</p>
            </div>

            {/* What you can do — action steps */}
            <div className="px-5 pt-2 pb-5" style={{ backgroundColor: config.light }}>
              <p className="text-base font-semibold uppercase tracking-widest text-gray-500 mb-3">{whatYouCanDo}</p>
              <ul className="space-y-2">
                {actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5"
                      style={{ backgroundColor: config.bg }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-lg text-gray-700 leading-snug">{action}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })()}

      {/* Statistics row */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="text-center">
          <p className="text-base text-muted-foreground">{t.highest_rate}</p>
          <p className="text-2xl sm:text-3xl font-bold text-[#8b3a62]">{highestState ? `${highestState[1].diabetes.toFixed(1)}%` : "—"}</p>
          <p className="text-base text-muted-foreground">{highestState ? `(${getStateNameTranslated(highestState[0], lang as "en" | "ms" | "zh")})` : ""}</p>
        </div>
        <div className="text-center">
          <p className="text-base text-muted-foreground">{t.lowest_rate}</p>
          <p className="text-2xl sm:text-3xl font-bold text-[#1a5276]">{lowestState ? `${lowestState[1].diabetes.toFixed(1)}%` : "—"}</p>
          <p className="text-base text-muted-foreground">{lowestState ? `(${getStateNameTranslated(lowestState[0], lang as "en" | "ms" | "zh")})` : ""}</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-[var(--cb-sage-text)]/20 rounded-2xl p-3 flex gap-4">
        <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
        <p className="text-base font-medium">{t.disclaimer_text_map}</p>
      </div>
    </div>
  )
}
