"use client"

import { useState } from "react"
import Image from "next/image"
import { AlertCircle, X } from "lucide-react"

export type SectionBase = { label: string; bg: string; color: string; dot: string }

export type BodyMapEntry = {
  organ: string
  title: string
  accent: string
  symptoms: SectionBase & { items: string[] }
  danger: SectionBase & { text: string }
  tip: { label: string; text: string }
  image?: { src: string; caption: string }
}

export type BodyMapData = {
  brain: BodyMapEntry
  eyes: BodyMapEntry
  heart: BodyMapEntry
  kidneys: BodyMapEntry
  feet: BodyMapEntry
}

type BodyMapId = keyof BodyMapData

type BodyMapContent = {
  title: string
  emptyLabel: string
  data: BodyMapData
}

// Semantic colors for the new structure
const COLORS = {
  symptoms: { bg: "#FFF4E5", color: "#B86B11", dot: "#E08214" }, // Warning/Amber
  danger: { bg: "#FBEAF0", color: "#72243E", dot: "#993556" },   // Danger/Red
}

// ─── Static content ────────────────────────────────────────────────────────────
const bodyMapContent: Record<string, BodyMapContent> = {
  en: {
    title: "How the Three Highs affect your body",
    emptyLabel: "Click a hotspot on the body to see how the Three Highs affect that area",
    data: {
      brain: {
        organ: "Brain", title: "Stroke & cognitive decline", accent: "#534AB7",
        symptoms: { ...COLORS.symptoms, label: "Quick Check (Symptoms)", items: [
          "Sudden numbness in the face, arm, or leg.",
          "Confusion, trouble speaking, or blurred vision.",
          "Dizziness or a sudden, severe headache."
        ]},
        danger: { ...COLORS.danger, label: "The Triple Threat", text: "High blood pressure weakens brain vessels, while high cholesterol builds up \"plaque.\" When a vessel bursts or clogs, it causes a Stroke. High sugar further slows down the brain’s ability to recover." },
        tip: { label: "The SIHAT Tip", text: "\"Brain Food\" is real! Using our nutrition tool to choose foods high in Omega-3 helps keep your brain vessels flexible and reduces stroke risk." },
      },
      eyes: {
        organ: "Eyes", title: "Retinopathy & vision loss", accent: "#185FA5",
        symptoms: { ...COLORS.symptoms, label: "Quick Check (Symptoms)", items: [
          "Blurred or \"wavy\" vision.",
          "Seeing dark spots or \"floaters\" that won't go away.",
          "Difficulty seeing colors or poor night vision."
        ]},
        danger: { ...COLORS.danger, label: "The Triple Threat", text: "The tiny vessels in your eyes are extremely fragile. Diabetes causes them to leak fluid (Retinopathy), and Hypertension adds pressure that causes these leaks to bleed, leading to permanent blindness." },
        tip: { label: "The SIHAT Tip", text: "Protect your sight at the dinner plate. Stable blood sugar is the #1 way to stop eye damage. Use SIHAT to track your glycemic load." },
        image: { 
          src: "/images/body-map/diabetic-eye.jpg", 
          caption: "Diabetes causes tiny leaks in the eye's blood vessels, which can lead to blurry spots or vision loss." 
        },
      },
      heart: {
        organ: "Heart", title: "Heart attack & failure", accent: "#993556",
        symptoms: { ...COLORS.symptoms, label: "Quick Check (Symptoms)", items: [
          "Chest pain or a feeling of \"tightness\".",
          "Shortness of breath during light activity.",
          "Palpitations or a racing heartbeat."
        ]},
        danger: { ...COLORS.danger, label: "The Triple Threat", text: "This is the meeting point of the Three Highs. Diabetes weakens the heart muscle, Hypertension forces the heart to pump against high resistance, and Cholesterol narrows the \"fuel lines\" supplying the heart." },
        tip: { label: "The SIHAT Tip", text: "Your heart loves fiber! SIHAT helps you find local fiber-rich meals that act like a \"natural broom\" to sweep excess cholesterol out of your arteries." },
        image: { 
          src: "/images/body-map/diabetic-heart.jpg", 
          caption: "Over time, high blood pressure and sugar weaken the heart muscle, making it harder to pump blood to the rest of your body." 
        },
      },
      kidneys: {
        organ: "Kidneys", title: "Nephropathy & kidney failure", accent: "#854F0B",
        symptoms: { ...COLORS.symptoms, label: "Quick Check (Symptoms)", items: [
          "Swelling in the ankles, feet, or hands.",
          "Foamy urine or changes in urination frequency.",
          "Persistent itching or feeling very tired/weak."
        ]},
        danger: { ...COLORS.danger, label: "The Triple Threat", text: "Your kidneys are delicate filters. Diabetes \"gums up\" the filters with excess sugar, while Hypertension \"blasts\" the filters with high-pressure blood, causing scarring and eventually kidney failure." },
        tip: { label: "The SIHAT Tip", text: "Salt is the secret enemy. SIHAT helps you identify \"Hidden Salt\" in processed foods, instantly taking the pressure off your hardworking kidney filters." },
        image: { 
          src: "/images/body-map/diabetic-kidney.jpg", 
          caption: "Healthy kidneys (left) filter waste properly, while damaged kidneys (right) become smaller and lose their ability to clean your blood." 
        },
      },
      feet: {
        organ: "Feet & legs", title: "Neuropathy & diabetic foot", accent: "#0F6E56",
        symptoms: { ...COLORS.symptoms, label: "Quick Check (Symptoms)", items: [
          "Tingling, \"pins and needles,\" or burning pain.",
          "Loss of feeling (numbness)—not feeling small cuts.",
          "Slow-healing wounds or skin that feels unusually cold."
        ]},
        danger: { ...COLORS.danger, label: "The Triple Threat", text: "Diabetes destroys the nerves (Neuropathy), so you don't feel injuries. Meanwhile, Cholesterol narrows the blood vessels, meaning oxygen can't reach the wound to heal it, leading to serious infections." },
        tip: { label: "The SIHAT Tip", text: "Good circulation is a choice. By managing your Three Highs through our meal recommendations, you ensure healthy blood flow reaches your toes." },
        image: { 
          src: "/images/body-map/diabetic-foot.png", 
          caption: "High blood sugar can damage nerves and reduce blood flow, making it hard for small cuts or dry skin to heal properly." 
        },
      },
    },
  },
  ms: {
    title: "Bagaimana Tiga Serangkai mempengaruhi badan anda",
    emptyLabel: "Klik titik panas pada badan untuk melihat kesan Tiga Serangkai",
    data: {
      brain: {
        organ: "Otak", title: "Strok & penurunan kognitif", accent: "#534AB7",
        symptoms: { ...COLORS.symptoms, label: "Tanda-tanda", items: [
          "Kebas tiba-tiba pada muka, lengan, atau kaki.",
          "Kekeliruan, kesukaran bercakap, atau penglihatan kabur.",
          "Pening atau sakit kepala yang teruk secara tiba-tiba."
        ]},
        danger: { ...COLORS.danger, label: "Bahaya 3 Serangkai", text: "Tekanan darah tinggi melemahkan saluran otak, manakala kolesterol tinggi membentuk \"plak\". Apabila saluran pecah atau tersumbat, ia menyebabkan Strok. Gula tinggi pula melambatkan pemulihan otak." },
        tip: { label: "Pesanan SIHAT", text: "Gunakan alat pemakanan kami untuk memilih makanan tinggi Omega-3 yang membantu mengekalkan kelenturan saluran otak dan mengurangkan risiko strok." },
      },
      eyes: {
        organ: "Mata", title: "Retinopati & kehilangan penglihatan", accent: "#185FA5",
        symptoms: { ...COLORS.symptoms, label: "Tanda-tanda", items: [
          "Penglihatan kabur atau \"berombak\".",
          "Melihat bintik gelap yang tidak hilang.",
          "Kesukaran melihat warna atau penglihatan malam yang lemah."
        ]},
        danger: { ...COLORS.danger, label: "Bahaya 3 Serangkai", text: "Saluran kecil di mata anda sangat rapuh. Diabetes menyebabkannya bocor (Retinopati), dan Hipertensi menambah tekanan yang menyebabkan pendarahan, membawa kepada buta kekal." },
        tip: { label: "Pesanan SIHAT", text: "Gula darah yang stabil adalah cara utama untuk menghentikan kerosakan mata. Gunakan SIHAT untuk menjejaki beban glisemik anda." },
        image: { 
          src: "/images/body-map/diabetic-eye.jpg", 
          caption: "Diabetes menyebabkan kebocoran kecil pada saluran darah mata, yang boleh mengakibatkan penglihatan kabur." 
        },
      },
      heart: {
        organ: "Jantung", title: "Serangan & kegagalan jantung", accent: "#993556",
        symptoms: { ...COLORS.symptoms, label: "Tanda-tanda", items: [
          "Sakit dada atau rasa \"ketat\".",
          "Sesak nafas semasa aktiviti ringan.",
          "Jantung berdebar-debar atau berdegup kencang."
        ]},
        danger: { ...COLORS.danger, label: "Bahaya 3 Serangkai", text: "Di sinilah titik pertemuan Tiga Serangkai. Diabetes melemahkan otot jantung, Hipertensi memaksanya mengepam lebih kuat, dan Kolesterol menyempitkan saluran bahan api ke jantung." },
        tip: { label: "Pesanan SIHAT", text: "SIHAT membantu anda mencari makanan tempatan kaya serat yang bertindak seperti \"penyapu semula jadi\" untuk membuang kolesterol berlebihan dari arteri anda." },
        image: { 
          src: "/images/body-map/diabetic-heart.jpg", 
          caption: "Lama-kelamaan, tekanan darah dan gula yang tinggi melemahkan otot jantung, menyebabkannya sukar mengepam darah ke seluruh badan." 
        },
      },
      kidneys: {
        organ: "Buah pinggang", title: "Nefropati & kegagalan buah pinggang", accent: "#854F0B",
        symptoms: { ...COLORS.symptoms, label: "Tanda-tanda", items: [
          "Bengkak di pergelangan kaki, kaki, atau tangan.",
          "Air kencing berbuih atau kekerapan kencing berubah.",
          "Gatal berterusan atau rasa sangat letih/lemah."
        ]},
        danger: { ...COLORS.danger, label: "Bahaya 3 Serangkai", text: "Buah pinggang adalah penapis halus. Diabetes \"melekitkan\" penapis dengan gula berlebihan, manakala Hipertensi \"menghentam\" penapis dengan tekanan tinggi, menyebabkan parut dan kegagalan buah pinggang." },
        tip: { label: "Pesanan SIHAT", text: "Garam adalah musuh tersembunyi. SIHAT membantu anda mengenal pasti garam tersembunyi dalam makanan, lalu mengurangkan tekanan pada buah pinggang anda serta-merta." },
        image: { 
          src: "/images/body-map/diabetic-kidney.jpg", 
          caption: "Buah pinggang sihat (kiri) menapis sisa dengan betul, manakala buah pinggang yang rosak (kanan) mengecut dan gagal mencuci darah anda." 
        },
      },
      feet: {
        organ: "Kaki & Saraf", title: "Neuropati & kaki diabetik", accent: "#0F6E56",
        symptoms: { ...COLORS.symptoms, label: "Tanda-tanda", items: [
          "Rasa semut-semut, kebas, atau sakit terbakar.",
          "Hilang deria rasa—tidak menyedari luka kecil.",
          "Luka lambat sembuh atau kulit berasa sejuk."
        ]},
        danger: { ...COLORS.danger, label: "Bahaya 3 Serangkai", text: "Diabetes memusnahkan saraf (Neuropati) supaya anda tidak berasa sakit. Kolesterol pula menyempitkan saluran darah, menghalang oksigen daripada menyembuhkan luka dan membawa kepada jangkitan serius." },
        tip: { label: "Pesanan SIHAT", text: "Peredaran darah yang baik adalah pilihan. Dengan menguruskan Tiga Serangkai melalui cadangan makanan kami, darah yang sihat dapat sampai ke jari kaki anda." },
        image: { 
          src: "/images/body-map/diabetic-foot.png", 
          caption: "Gula darah tinggi boleh merosakkan saraf dan mengurangkan aliran darah, menyebabkan luka kecil atau kulit kering sukar sembuh." 
        },
      },
    },
  },
  zh: {
    title: "三高如何影响您的身体",
    emptyLabel: "点击身体上的热点，查看三高如何影响该部位",
    data: {
      brain: {
        organ: "大脑", title: "中风与认知衰退", accent: "#534AB7",
        symptoms: { ...COLORS.symptoms, label: "常见症状", items: [
          "面部、手臂或腿部突然麻木。",
          "意识混乱、说话困难或视力模糊。",
          "头晕或突发性剧烈头痛。"
        ]},
        danger: { ...COLORS.danger, label: "三重威胁", text: "高血压会削弱脑血管，而高胆固醇会形成“斑块”。当血管破裂或堵塞时，就会导致中风。高血糖则进一步减缓大脑的恢复能力。" },
        tip: { label: "SIHAT 提示", text: "“健脑食物”真实存在！使用我们的营养工具选择富含Omega-3的食物，有助于保持脑血管弹性并降低中风风险。" },
      },
      eyes: {
        organ: "眼睛", title: "视网膜病变与视力丧失", accent: "#185FA5",
        symptoms: { ...COLORS.symptoms, label: "常见症状", items: [
          "视力模糊或视物变形。",
          "眼前出现挥之不去的黑点或“飞蚊”。",
          "色觉困难或夜视能力差。"
        ]},
        danger: { ...COLORS.danger, label: "三重威胁", text: "眼部的微小血管极其脆弱。糖尿病导致血管渗漏（视网膜病变），而高血压增加的压力会导致这些渗漏出血，最终导致永久性失明。" },
        tip: { label: "SIHAT 提示", text: "保护视力从餐桌开始。稳定的血糖是阻止眼部损伤的首要方法。使用 SIHAT 追踪您的升糖负荷，保持视野清晰。" },
        image: { 
          src: "/images/body-map/diabetic-eye.jpg", 
          caption: "糖尿病会导致眼部血管出现微小渗漏，从而导致视力模糊或视力丧失。" 
        },
      },
      heart: {
        organ: "心脏", title: "心脏病发作与心力衰竭", accent: "#993556",
        symptoms: { ...COLORS.symptoms, label: "常见症状", items: [
          "胸痛或“紧绷”感。",
          "轻度活动时感到呼吸短促。",
          "心悸或心跳过速。"
        ]},
        danger: { ...COLORS.danger, label: "三重威胁", text: "这是“三高”的交汇点。糖尿病削弱心肌，高血压迫使心脏在高阻力下泵血，而高胆固醇阻塞了供应心脏的“燃料管”（动脉）。" },
        tip: { label: "SIHAT 提示", text: "您的心脏需要纤维！SIHAT 帮助您找到富含纤维的本地美食，它们就像“天然扫帚”一样清除动脉中多余的胆固醇。" },
        image: { 
          src: "/images/body-map/diabetic-heart.jpg", 
          caption: "长期的高血压和高血糖会削弱心肌，使心脏更难向全身泵血。" 
        },
      },
      kidneys: {
        organ: "肾脏", title: "肾病与肾衰竭", accent: "#854F0B",
        symptoms: { ...COLORS.symptoms, label: "常见症状", items: [
          "脚踝、双脚或手部肿胀。",
          "尿液起泡沫或排尿频率改变。",
          "持续瘙痒或感到非常疲倦/虚弱。"
        ]},
        danger: { ...COLORS.danger, label: "三重威胁", text: "您的肾脏是脆弱的过滤器。糖尿病过多的糖分会使过滤器“黏结”，而高血压则用高压血液“冲击”过滤器，导致结疤并最终引发尿毒症。" },
        tip: { label: "SIHAT 提示", text: "盐是隐形杀手。SIHAT 帮助您识别加工食品中的“隐形盐”，瞬间减轻肾脏过滤器的压力。" },
        image: { 
          src: "/images/body-map/diabetic-kidney.jpg", 
          caption: "健康的肾脏（左）能正常过滤废物，而受损的肾脏（右）会萎缩并失去清洁血液的能力。" 
        },
      },
      feet: {
        organ: "双脚与腿部", title: "神经病变与糖尿病足", accent: "#0F6E56",
        symptoms: { ...COLORS.symptoms, label: "常见症状", items: [
          "刺痛、“针扎感”或灼痛。",
          "失去知觉（麻木）——感觉不到小伤口。",
          "伤口愈合缓慢或皮肤感觉异常寒冷。"
        ]},
        danger: { ...COLORS.danger, label: "三重威胁", text: "糖尿病会破坏神经（神经病变），使您感觉不到受伤。同时，高胆固醇使血管变窄，导致氧气无法到达伤口进行愈合，从而引发严重感染。" },
        tip: { label: "SIHAT 提示", text: "良好的血液循环是可以选择的。通过我们的膳食建议管理三高，确保健康的血液流向您的脚趾。" },
        image: { 
          src: "/images/body-map/diabetic-foot.png", 
          caption: "高血糖会损伤神经并减少血流量，使小伤口或皮肤干燥难以正常愈合。" 
        },
      },
    },
  },
}

// ─── Hotspot layout ────────────────────────────────────────────────────────────

const hotspotPositions: { id: BodyMapId; top: string; left: string; color: string }[] = [
  { id: "brain",   top: "7%",  left: "50%", color: "#534AB7" },
  { id: "eyes",    top: "13%", left: "45%", color: "#185FA5" },
  { id: "heart",   top: "28%", left: "58%", color: "#993556" },
  { id: "kidneys", top: "48%", left: "40%", color: "#854F0B" },
  { id: "feet",    top: "87%", left: "45%", color: "#0F6E56" },
]

// ─── Props ────────────────────────────────────────────────────────────────

interface BodyMapProps {
  lang: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BodyMap({ lang }: BodyMapProps) {
  const t = bodyMapContent[lang] ?? bodyMapContent.en
  const [activeId, setActiveId] = useState<BodyMapId | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function handleHotspot(id: BodyMapId) {
    setActiveId(id)
    if (window.innerWidth < 768) setDrawerOpen(true)
  }

  function close() {
    setActiveId(null)
    setDrawerOpen(false)
  }

  const active = activeId ? t.data[activeId] : null

  const PanelContent = ({ d }: { d: BodyMapEntry }) => (
    <>
      <div className="h-1 w-full" style={{ backgroundColor: d.accent }} />
      <div className="flex items-start justify-between p-4 pb-0">
        <div>
          <p className="text-base font-medium uppercase tracking-widest text-muted-foreground mb-0.5">{d.organ}</p>
          <h3 className="text-xl font-semibold" style={{ color: d.accent }}>{d.title}</h3>
        </div>
        <button
          onClick={close}
          className="w-7 h-7 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 mt-0.5"
          style={{ borderColor: "var(--border)" }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="p-4 flex flex-col gap-4">
        {/* Symptoms Section */}
        <div>
          <span
            className="inline-flex items-center gap-1.5 text-base font-medium px-2.5 py-1 rounded-full mb-2"
            style={{ backgroundColor: d.symptoms.bg, color: d.symptoms.color }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.symptoms.dot }} />
            {d.symptoms.label}
          </span>
          <ul className="list-disc pl-5 space-y-1 text-lg leading-relaxed text-muted-foreground">
            {d.symptoms.items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Danger Section */}
        <div>
          <span
            className="inline-flex items-center gap-1.5 text-base font-medium px-2.5 py-1 rounded-full mb-2"
            style={{ backgroundColor: d.danger.bg, color: d.danger.color }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.danger.dot }} />
            {d.danger.label}
          </span>
          <p className="text-lg leading-relaxed text-muted-foreground">{d.danger.text}</p>
        </div>

        {/* Tip Section (Reusing the highlighted "Watch" box style) */}
        <div className="rounded-xl p-3 mt-1" style={{ backgroundColor: "var(--muted)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💡</span>
            <p className="text-base font-medium uppercase tracking-widest text-muted-foreground">
              {d.tip.label}
            </p>
          </div>
          <p className="text-lg leading-relaxed">{d.tip.text}</p>
        </div>

        {d.image && (
          <div className="mt-4 border rounded-xl overflow-hidden bg-white">
            <div className="relative w-full h-80 sm:h-100 bg-slate-50">
              <img
                src={d.image.src}
                alt={d.image.caption}
                // "object-contain" ensures the whole diagram is visible
                // "p-2" adds a small buffer so the image doesn't touch the borders
                className="w-full h-full object-contain p-2"
              />
            </div>
            <div className="bg-muted/30 p-3 border-t">
              <p className="text-base leading-relaxed text-foreground italic">
                {d.image.caption}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-6 min-h-[550px]">

        {/* Body image with hotspots */}
        <div className="flex-shrink-0 flex justify-center sm:justify-start">
          <div className="relative w-[220px] h-[480px]">
            <Image
              src="/images/human-body-2.png"
              alt="Human body diagram"
              fill
              className="object-contain"
            />
            {hotspotPositions.map(({ id, top, left, color }) => (
              <div
                key={id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group"
                style={{ top, left }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none
                  opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-20">
                  <div
                    className="text-base font-medium px-2.5 py-1.5 rounded-lg shadow-md text-white"
                    style={{ backgroundColor: color }}
                  >
                    {t.data[id].organ}
                  </div>
                  {/* Arrow */}
                  <div
                    className="w-2 h-2 mx-auto rotate-45 -mt-1"
                    style={{ backgroundColor: color }}
                  />
                </div>

                {/* Hotspot button */}
                <button
                  onClick={() => handleHotspot(id)}
                  className="relative block"
                  aria-label={t.data[id].organ}
                >
                  <span
                    className="absolute inset-0 rounded-full animate-ping"
                    style={{ backgroundColor: color, animationDuration: "2s", opacity: 0.3 }}
                  />
                  <span
                    className="relative flex w-6 h-6 rounded-full border-2 border-white items-center justify-center transition-transform duration-150 group-hover:scale-125"
                    style={{
                      backgroundColor: color,
                      boxShadow: activeId === id ? `0 0 0 3px ${color}40` : "0 1px 4px rgba(0,0,0,0.2)",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop side panel */}
        <div className="hidden sm:flex flex-1 min-w-0">
          {!active ? (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-3 text-foreground text-lg text-center border border-dashed rounded-2xl p-8"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-10 h-10" />
              </div>
              {t.emptyLabel}
            </div>
          ) : (
            <div
              className="flex-1 rounded-2xl border overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200 overflow-y-auto max-h-[550px]"
              style={{ borderColor: "var(--border)" }}
            >
              <PanelContent d={active} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom drawer */}
      {drawerOpen && active && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={close} />
          <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background rounded-t-2xl max-h-[75vh] overflow-y-auto animate-in slide-in-from-bottom duration-250">
            <div className="w-9 h-1 rounded-full bg-border mx-auto mt-3 mb-1" />
            <PanelContent d={active} />
          </div>
        </>
      )}
    </div>
  )
}