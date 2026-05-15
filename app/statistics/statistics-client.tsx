// Client-side component for displaying statistics about three highs in Malaysia.
// It also supports three languages: English (en), Malay (ms), and Chinese (zh).
"use client"

import { PageLayout } from "@/components/page-layout"
import { useState, useEffect, useRef } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell, LabelList } from "recharts"
import { AlertCircle, Heart, Activity, Eye, X, ChevronDown, Users, TrendingUp, Skull, HeartPulse, TriangleAlert, CalendarCheck, CircleAlert, ArrowRight } from "lucide-react"
import { MalaysiaChoroplethMap, type YearMapData } from "@/components/malaysia-choropleth-map"
import { MenuScanCTA } from "@/components/menu-scan-cta"
import Image from "next/image"
import { ThreeHighsInsights } from "@/components/three-highs-insights"
import Link from "next/link"

// ─── Data types and content ───────────────────────────────────────────────
export interface NationalTrendRow {
  trend_id: number
  year: number
  patients: number
  diabetes: string 
  hypertension: string
  hyperlipidemia: string // decimal comes back as string from Drizzle/pg
}

export interface EthnicityRow {
  ethnicity_id: number
  ethnicity: string
  diabetes: string 
  hypertension: string
  hyperlipidemia: string // decimal as string from Drizzle/pg
}

interface StatisticsClientProps {
  dataByYear: Record<string, YearMapData>
  availableYears: string[]
  nationalTrend: NationalTrendRow[]
  ethnicityData: EthnicityRow[]
}

// ─── Stat card colour config ───────────────────────────────────────────────
// Each card gets its own accent colour (top bar + icon bg + value text).
const STAT_COLORS = [
  { accent: "#378ADD", iconBg: "#E6F1FB", valueCss: "#185FA5" },
  { accent: "#D85A30", iconBg: "#FAECE7", valueCss: "#993C1D" },
  { accent: "#BA7517", iconBg: "#FAEEDA", valueCss: "#854F0B" },
]
const STAT2_COLORS = [
  { accent: "#1D9E75", iconBg: "#E1F5EE", valueCss: "#0F6E56" },
  { accent: "#7F77DD", iconBg: "#EEEDFE", valueCss: "#3C3489" },
  { accent: "#E24B4A", iconBg: "#FCEBEB", valueCss: "#A32D2D" },
]

// Content for statistics page, organized by language for easy access in the component
const content = {
  en: {
    page_title: "Malaysia's Three Highs: Why Diabetes Comes First",
    page_subtitle: "Diabetes is at the heart of Malaysia's health challenge. Learn how it links to high blood pressure and cholesterol, and how small changes can make a big difference.",
    summary_why: "Why this matters for you",
    summary_body: "Malaysia has one of the highest diabetes rates in Asia, and it rarely comes alone; high blood pressure and cholesterol often follow. Scroll down to understand the picture, then take one small step today.",
    summary_cta1: "Check your food choices",
    summary_cta2: "Learn about three \"highs\"",
    stat_nudge: [
      { text: "That's someone at every dining table.", link: "Learn the warning signs →", href: "/learn" },
      { text: "Regular screening is the best defence.", link: "Find a clinic near you →", href: "/healthcare" },
      { text: "Behind every number is a family.", link: "See how food can help →", href: "/food" },
    ],
    stats_eyebrow: "Diabetes in Malaysia",
    stats_heading: "The numbers are closer to home than you think",
    stats_title2: "The Three Highs in Malaysia",
    stats: [
      { value: "1 in 5", label: "Malaysian adults have diabetes", image: "/images/1-in-5.png" },
      { value: "2 in 5", label: "Elderly aged 60+ are affected", icon: Users },
      { value: "4.75M", label: "People living with diabetes.", icon: Heart },
    ],
    stats2: [
      { value: "3 in 4", label: "Elderly have high blood pressure or high cholesterol", icon: HeartPulse },
      { value: "68%", label: "Elderly living with two of the three highs", icon: CircleAlert },
      { value: "30%", label: "Elderly have all three conditions", icon: TriangleAlert },
    ],
    tab_prevalence: "Diabetes Prevalence",
    tab_trends: "\"Three Highs\" Trends",
    tab_hints: "💡 Tip: Use the buttons below to switch between different views of the data. ",
    map_title: "Explore the Situation in Your Area",
    map_subtitle: "Every state faces different hurdles. Find your home on the map to see local prevalence and discover how we can support each other.",
    trends_title: "Understanding \"Three Highs\" Trends in Malaysia",
    trends_subtitle: "This chart shows how diabetes, hypertension, and hyperlipidemia (high cholesterol) prevalence has changed over the last decade.",
    trends_y_label: "Prevalence (%)",
    tooltip_label: "Diabetes",
    tooltip_label2: "Hypertension",
    tooltip_label3: "Hyperlipidemia",
    trends_note: "In just 10 years, the number of Malaysians living with diabetes has nearly doubled. A rising line doesn't have to be our future. By starting small healthy habits today, we can work together to turn this trend around.",
    select_year: "Year",
    ethnicity_title: "Health in Our Communities",
    ethnicity_subtitle1: "Data from Malaysia National Health and Morbidity Survey (NHMS), 2023",
    ethnicity_subtitle: "Our cultural backgrounds and traditions shape us. Understanding these unique trends helps us provide better care for our elders across all communities.",
    ethnicity_y_label: "Percentage (%)",
    click_bar: "👆 Tap any bar or label to learn more",
    ethnicity_names: {
      Malay: "Malay",
      Chinese: "Chinese",
      Indian: "Indian",
      'Bumiputera Sabah': "Bumiputera Sabah",
      'Bumiputera Sarawak': "Bumiputera Sarawak",
      Others: "Others",
    },
    legend_high: "High Prevalence (>14%)",
    legend_medium: "Medium Prevalence (7-14%)",
    legend_low: "Low Prevalence (<7%)",
    highest_rate: "Highest Rate",
    lowest_rate: "Lowest Rate",
    average_rate: "Average Rate",
    click_state: "👇 Tap a state for more information",
    disclaimer_text_map: "For 2015 data, Labuan prevalence is represented by the pooled Sabah/Labuan regional data due to reporting constraints in the original NHMS datasets.",
    disclaimer_text: "These numbers represent real people who deserve support and accurate information. This is why understanding diabetes matters.",
    good_news_cta: "See foods that help manage all three →",
  },
  ms: {
    page_title: "Tiga Penyakit Tinggi Malaysia: Mengapa Diabetes Didahulukan",
    page_subtitle: "Diabetes adalah teras cabaran kesihatan Malaysia. Ketahui bagaimana ia berkait dengan tekanan darah tinggi dan kolesterol, dan bagaimana perubahan kecil boleh membuat perbezaan besar.",
    summary_why: "Mengapa ini penting untuk anda",
    summary_body: "Malaysia mempunyai salah satu kadar diabetes tertinggi di Asia, dan ia jarang datang bersendirian; tekanan darah tinggi dan kolesterol sering mengikuti. Tatal ke bawah untuk memahami gambaran ini, kemudian ambil satu langkah kecil hari ini.",
    summary_cta1: "Semak pilihan makanan anda",
    summary_cta2: "Ketahui tentang tiga penyakit tinggi",
    stat_nudge: [
      { text: "Itu seseorang di hampir setiap meja makan.", link: "Ketahui tanda amaran →", href: "/learn" },
      { text: "Saringan berkala adalah pertahanan terbaik.", link: "Cari klinik terdekat →", href: "/healthcare" },
      { text: "Di sebalik setiap angka ada keluarga.", link: "Lihat bagaimana makanan dapat membantu →", href: "/food" },
    ],
    stats_eyebrow: "Diabetes di Malaysia",
    stats_heading: "Angka-angka ini lebih dekat dari yang anda sangka",
    stats_title2: "Tiga Penyakit Tinggi di Malaysia",
    stats: [
      { value: "1 dalam 5", label: "Orang dewasa Malaysia menghidap diabetes", image: "/images/1-in-5.png" },
      { value: "2 dalam 5", label: "Warga emas berusia 60+ terjejas", icon: TrendingUp },
      { value: "4.75J", label: "Orang hidup dengan diabetes", icon: Heart },
    ],
    stats2: [
      { value: "3 dalam 4", label: "Warga emas mempunyai hipertensi atau hiperlipidemia (kolesterol tinggi)", icon: HeartPulse },
      { value: "68%", label: "Warga emas yang hidup dengan dua daripada tiga penyakit tinggi", icon: CircleAlert },
      { value: "30%", label: "Warga emas yang mempunyai ketiga-tiga keadaan", icon: TriangleAlert },
    ],
    tab_prevalence: "Prevalens Diabetes",
    tab_trends: "Aliran \"Tiga Penyakit Tinggi\"",
    tab_hints: "💡 Tip: Gunakan butang di bawah untuk bertukar antara pandangan data yang berbeza.",
    map_title: "Terokai Situasi di Kawasan Anda",
    map_subtitle: "Setiap negeri menghadapi cabaran yang berbeza. Cari rumah anda di peta untuk melihat prevalens tempatan dan temui bagaimana kita dapat saling mendukung.",
    trends_title: "Aliran \"Tiga Penyakit Tinggi\" di Malaysia",
    trends_subtitle: "Carta ini menunjukkan bagaimana prevalens diabetes, hipertensi, dan hiperlipidemia (kolesterol tinggi) telah berubah selama dekade terakhir.",
    trends_y_label: "Prevalens (%)",
    tooltip_label: "Diabetes",
    tooltip_label2: "Hipertensi",
    tooltip_label3: "Hiperlipidemia",
    trends_note: "Dalam masa 10 tahun sahaja, bilangan rakyat Malaysia yang menghidap diabetes hampir dua kali ganda. Garis yang meningkat tidak semestinya masa depan kita. Dengan memulakan tabiat sihat kecil hari ini, kita boleh bekerjasama untuk membalikkan trend ini.",
    select_year: "Tahun",
    ethnicity_title: "Kesihatan dalam Komuniti Kita",
    ethnicity_subtitle1: "Data dari Malaysia National Health and Morbidity Survey (NHMS) terbaharu yang mempunyai data diabetes, 2023",
    ethnicity_subtitle: "Memahami bagaimana diabetes mempengaruhi komuniti kita yang berbeza membantu kita memberikan penjagaan yang lebih baik untuk semua.",
    ethnicity_y_label: "Peratusan (%)",
    click_bar: "👆 Klik pada bar atau label untuk maklumat lanjut",
    ethnicity_names: {
      Malay: "Melayu",
      Chinese: "Cina",
      Indian: "India",
      'Bumiputera Sabah': "Bumiputera Sabah",
      'Bumiputera Sarawak': "Bumiputera Sarawak",
      Others: "Lain-lain",
    },
    legend_high: "Risiko Tinggi (>14%)",
    legend_medium: "Risiko Sederhana (7-14%)",
    legend_low: "Risiko Rendah (<7%)",
    highest_rate: "Kadar Tertinggi",
    lowest_rate: "Kadar Terendah",
    average_rate: "Kadar Purata",
    click_state: "👇 Klik pada negeri untuk maklumat lanjut",
    disclaimer_text_map: "Untuk data 2015, prevalens Labuan diwakili oleh data regional Sabah/Labuan yang digabungkan kerana kekangan pelaporan dalam dataset NHMS asal.",
    disclaimer_text: "Nombor-nombor ini mewakili orang sebenar yang memerlukan sokongan dan maklumat yang tepat. Inilah sebabnya memahami diabetes penting.",
    good_news_cta: "Lihat makanan yang membantu mengurus ketiga-tiga penyakit tinggi →",
  },
  zh: {
    page_title: "马来西亚三高：为何糖尿病最受关注",
    page_subtitle: "糖尿病是马来西亚健康挑战的核心。了解它与高血压和胆固醇的关联，以及小小的改变如何带来大大的不同。",
    summary_why: "为什么这对您很重要",
    summary_body: "马来西亚是亚洲糖尿病发病率最高的国家之一，而且它很少单独出现；高血压和高胆固醇往往相伴而来。向下滚动了解全貌，然后今天迈出一小步。",
    summary_cta1: "检查您的饮食选择",
    summary_cta2: "了解三高",
    stat_nudge: [
      { text: "几乎每张餐桌上都有一个这样的人。", link: "了解警示信号 →", href: "/learn" },
      { text: "定期筛查是最好的防御。", link: "找到附近的诊所 →", href: "/healthcare" },
      { text: "每个数字背后都是一个家庭。", link: "了解饮食如何帮助 →", href: "/food" },
    ],
    stats_eyebrow: "马来西亚的糖尿病",
    stats_heading: "这些数字比你想象的更贴近生活",
    stats_title2: "马来西亚的三高",
    stats: [
      { value: "五分之一", label: "马来西亚成年人患有糖尿病", image: "/images/1-in-5.png" },
      { value: "五分之二", label: "60岁以上老年人受影响", icon: TrendingUp },
      { value: "475万", label: "人患有糖尿病", icon: Heart },
    ],
    stats2: [
      { value: "四分之三", label: "60岁以上老年人患有高血压或高胆固醇", icon: HeartPulse },
      { value: "68%", label: "60岁以上老年人患有其中两种三高", icon: CircleAlert },
      { value: "30%", label: "60岁以上老年人患有全部三种疾病", icon: TriangleAlert },
    ],
    tab_prevalence: "糖尿病患病率",
    tab_trends: "三高趋势",
    tab_hints: "💡 提示：使用下面的按钮在不同的数据视图之间切换。",
    map_title: "探索您所在地区的情况",
    map_subtitle: "每个州面临不同的挑战。在地图上找到您的家，查看当地的患病率，并了解我们如何相互支持。",
    trends_title: "了解马来西亚的三高趋势",
    trends_subtitle: "这张图表显示了过去十年糖尿病、高血压和高胆固醇的患病率如何变化。",
    trends_y_label: "患病率 (%)",
    tooltip_label: "糖尿病",
    tooltip_label2: "高血压",
    tooltip_label3: "高胆固醇",
    trends_note: "短短10年间，马来西亚糖尿病患者人数几乎翻倍。上升的趋势不一定是我们的未来。从今天开始养成健康习惯，我们可以共同努力扭转这一趋势。",
    select_year: "年份",
    ethnicity_title: "我们社区的健康",
    ethnicity_subtitle1: "来自最新包含糖尿病数据的马来西亚国家健康与疾病调查（NHMS）的数据, 2023年",
    ethnicity_subtitle: "了解糖尿病如何影响我们不同的社区，有助于我们为每个人提供更好的护理。",
    ethnicity_y_label: "百分比 (%)",
    click_bar: "👆 点击任何条形或标签了解更多",
    ethnicity_names: {
      Malay: "马来人",
      Chinese: "华人",
      Indian: "印度人",
      'Bumiputera Sabah': "沙巴土著",
      'Bumiputera Sarawak': "砂拉越土著",
      Others: "其他人",
    },
    legend_high: "高风险 (>14%)",
    legend_medium: "中等风险 (7-14%)",
    legend_low: "较低风险 (<7%)",
    highest_rate: "最高率",
    lowest_rate: "最低率",
    average_rate: "平均率",
    click_state: "👇 点击州属查看详情",
    disclaimer_text_map: "对于2015年的数据，由于原始NHMS数据集中的报告限制，纳闽的患病率由合并的沙巴/纳闽区域数据表示。",
    disclaimer_text: "这些数字代表真实的人，他们需要支持和准确的信息。这就是为什么了解糖尿病很重要。",
    good_news_cta: "查看有助于管理三高的食物 →",
  },
}

// ─── Ethnicity explanation data ────────────────────────────────────────────
// Each entry has: why (context), actions (what to do), and highlight (which
// of the three highs is most notable for this group).

interface EthnicityExplanation {
  highlight: { label: { en: string; ms: string; zh: string }; value: string; color: string }
  why: { en: string; ms: string; zh: string }
  actions: { en: string[]; ms: string[]; zh: string[] }
}

const ETHNICITY_EXPLANATIONS: Record<string, EthnicityExplanation> = {
  "Indian": {
    highlight: { label: { en: "Highest diabetes rate", ms: "Kadar diabetes tertinggi", zh: "最高糖尿病率" }, value: "26.4%", color: "#D85A30" },
    why: {
      en: "The Indian community has the highest diabetes rate at 26.4% — roughly 1 in 4 adults. This is compounded by hypertension at 29.7% and high cholesterol at 33.8%. A key contributor is higher genetic sensitivity to insulin resistance, alongside diets rich in refined carbohydrates like white rice and roti canai.",
      ms: "Komuniti India mempunyai kadar diabetes tertinggi pada 26.4% — kira-kira 1 dalam 4 orang dewasa. Ini diburukkan lagi oleh hipertensi pada 29.7% dan kolesterol tinggi pada 33.8%. Penyumbang utama adalah sensitiviti genetik yang lebih tinggi terhadap rintangan insulin, bersama diet yang kaya dengan karbohidrat halus seperti nasi putih dan roti canai.",
      zh: "印度裔社群糖尿病患病率最高，达26.4%，约每4名成年人中就有1人患病。合并高血压29.7%和高胆固醇33.8%，情况更为严峻。主要原因是对胰岛素抵抗的遗传敏感性较高，加上饮食中白米和印度煎饼等精制碳水化合物摄入过多。",
    },
    actions: {
      en: [
        "Ask your doctor for an HbA1c blood test — it gives a 3-month picture of blood sugar, more accurate than a single reading.",
        "Try substituting white rice with brown rice or cauliflower rice for at least one meal a day.",
        "Request a cholesterol (lipid panel) test at your next clinic visit — high cholesterol has no symptoms.",
      ],
      ms: [
        "Minta doktor anda ujian darah HbA1c — ia memberikan gambaran gula darah selama 3 bulan, lebih tepat daripada satu bacaan sahaja.",
        "Cuba gantikan nasi putih dengan nasi perang atau nasi kembang kol untuk sekurang-kurangnya satu hidangan sehari.",
        "Minta ujian kolesterol (panel lipid) pada lawatan klinik seterusnya — kolesterol tinggi tidak mempunyai gejala.",
      ],
      zh: [
        "请医生为您做HbA1c血液检查——它能反映3个月的血糖水平，比单次读数更准确。",
        "尝试用糙米或花椰菜饭替代白米，至少每天一餐。",
        "在下次门诊时要求进行胆固醇（血脂）检查——高胆固醇没有症状。",
      ],
    },
  },

  "Bumiputera Sarawak": {
    highlight: { label: { en: "Highest hypertension rate", ms: "Kadar hipertensi tertinggi", zh: "最高高血压率" }, value: "41.1%", color: "#7F77DD" },
    why: {
      en: "While Bumiputera Sarawak has a diabetes rate of 17.2%, the most striking number is hypertension at 41.1% — the highest of any group — alongside high cholesterol at 38.7%. Urbanisation has shifted many from physically active traditional lifestyles to sedentary routines, while saltier processed foods have become more common.",
      ms: "Walaupun Bumiputera Sarawak mempunyai kadar diabetes 17.2%, angka yang paling ketara adalah hipertensi pada 41.1% — tertinggi dalam kalangan semua kumpulan — bersama kolesterol tinggi pada 38.7%. Pembandaran telah mengubah ramai daripada gaya hidup tradisional yang aktif kepada rutin yang tidak aktif, sementara makanan yang lebih masin dan diproses menjadi lebih biasa.",
      zh: "砂拉越土著糖尿病率为17.2%，但最突出的数字是高血压41.1%——所有族群中最高——以及高胆固醇38.7%。城市化使许多人从传统的体力活动生活方式转变为久坐的生活方式，同时更咸的加工食品也变得更普遍。",
    },
    actions: {
      en: [
        "Check your blood pressure regularly — 41% hypertension means nearly 1 in 2 adults may be affected, often without knowing.",
        "Reduce salt in cooking; try flavouring with herbs, turmeric, or lemongrass instead of extra seasoning.",
        "A 20-minute walk after dinner three times a week can meaningfully lower both blood pressure and blood sugar.",
      ],
      ms: [
        "Periksa tekanan darah anda secara kerap — hipertensi 41% bermakna hampir 1 dalam 2 orang dewasa mungkin terjejas, selalunya tanpa mengetahuinya.",
        "Kurangkan garam dalam masakan; cuba perisa dengan herba, kunyit, atau serai sebagai ganti perasa tambahan.",
        "Berjalan kaki 20 minit selepas makan malam tiga kali seminggu boleh menurunkan tekanan darah dan gula darah dengan ketara.",
      ],
      zh: [
        "定期检查血压——41%的高血压意味着近1/2的成年人可能受影响，但往往不自知。",
        "减少烹饪用盐，尝试用香草、姜黄或香茅代替额外的调味料。",
        "每周三次饭后步行20分钟，可以显著降低血压和血糖。",
      ],
    },
  },

  "Malay": {
    highlight: { label: { en: "Highest cholesterol rate", ms: "Kadar kolesterol tertinggi", zh: "最高胆固醇率" }, value: "34.6%", color: "#BA7517" },
    why: {
      en: "The Malay community has a diabetes rate of 16.2% alongside hypertension at 29.6% and the highest cholesterol rate at 34.6%. Hidden sugars in traditional favourites like teh tarik, kuih-muih, and nasi lemak are a major contributor — these add up quickly without feeling like \"eating badly\".",
      ms: "Komuniti Melayu mempunyai kadar diabetes 16.2% bersama hipertensi pada 29.6% dan kadar kolesterol tertinggi pada 34.6%. Gula tersembunyi dalam kegemaran tradisional seperti teh tarik, kuih-muih, dan nasi lemak adalah penyumbang utama — ini terkumpul dengan cepat tanpa rasa seperti 'makan dengan teruk'.",
      zh: "马来裔社群糖尿病率16.2%，高血压29.6%，胆固醇率最高达34.6%。传统美食如拉茶、马来糕点和椰浆饭中隐藏的糖分是主要原因——这些糖分积累很快，但感觉不像是在'乱吃'。",
    },
    actions: {
      en: [
        "Order teh o kosong instead of teh tarik — this single swap saves roughly 4–6 teaspoons of sugar per drink.",
        "Use the Suku-Suku-Separuh plate: ¼ rice, ¼ protein, ½ vegetables to manage both blood sugar and cholesterol.",
        "Get a full health screening (diabetes + blood pressure + cholesterol) at your nearest Klinik Kesihatan — it's free.",
      ],
      ms: [
        "Pesan teh o kosong sebagai ganti teh tarik — penukaran tunggal ini menjimatkan kira-kira 4–6 sudu teh gula setiap minuman.",
        "Gunakan pinggan Suku-Suku-Separuh: ¼ nasi, ¼ protein, ½ sayur-sayuran untuk mengurus gula darah dan kolesterol.",
        "Dapatkan saringan kesihatan penuh (diabetes + tekanan darah + kolesterol) di Klinik Kesihatan berdekatan anda — ia percuma.",
      ],
      zh: [
        "点teh o kosong（无糖茶）代替拉茶——这一个改变每杯可节省约4-6茶匙糖。",
        "使用Suku-Suku-Separuh饮食法：¼米饭、¼蛋白质、½蔬菜，同时管理血糖和胆固醇。",
        "在最近的政府诊所进行全面健康筛查（糖尿病+血压+胆固醇）——免费。",
      ],
    },
  },

  "Chinese": {
    highlight: { label: { en: "Rising cholesterol risk", ms: "Risiko kolesterol meningkat", zh: "胆固醇风险上升" }, value: "33.6%", color: "#378ADD" },
    why: {
      en: "The Chinese community has a diabetes rate of 15.1%, hypertension at 30.9%, and high cholesterol at 33.6%. While traditional Chinese diets can be well-balanced, the increasing shift to processed foods, hawker favourites high in oil and sodium, and sedentary urban lifestyles are driving all three conditions upward.",
      ms: "Komuniti Cina mempunyai kadar diabetes 15.1%, hipertensi pada 30.9%, dan kolesterol tinggi pada 33.6%. Walaupun diet tradisional Cina boleh seimbang, peralihan yang semakin meningkat kepada makanan yang diproses, kegemaran penjaja yang tinggi minyak dan sodium, dan gaya hidup bandar yang tidak aktif mendorong ketiga-tiga keadaan ini ke atas.",
      zh: "华人社群糖尿病率15.1%，高血压30.9%，高胆固醇33.6%。虽然传统中式饮食可以较为均衡，但日益转向加工食品、高油高钠的小贩美食以及久坐的都市生活方式，正在推动三高指数上升。",
    },
    actions: {
      en: [
        "Ask your hawker stall for less oil (少油, siu yau) when ordering — many will accommodate the request.",
        "Replace one daily sweet drink (Milo, herbal tea with sugar) with plain water or unsweetened barley.",
        "A 30-minute evening walk or tai chi session 3–4 times a week significantly reduces cholesterol and blood pressure over time.",
      ],
      ms: [
        "Minta gerai penjaja anda kurang minyak (少油, siu yau) ketika memesan — ramai yang akan memenuhi permintaan tersebut.",
        "Gantikan satu minuman manis harian (Milo, teh herba dengan gula) dengan air kosong atau barli tanpa gula.",
        "Berjalan petang selama 30 minit atau sesi tai chi 3–4 kali seminggu mengurangkan kolesterol dan tekanan darah secara ketara dari masa ke masa.",
      ],
      zh: [
        "在小贩摊点餐时要求少油（siu yau）——许多摊主会配合您的要求。",
        "将每天一杯含糖饮料（美禄、有糖凉茶）换成白开水或无糖大麦水。",
        "每周3-4次30分钟的晚间散步或太极练习，长期来看可以显著降低胆固醇和血压。",
      ],
    },
  },

  "Bumiputera Sabah": {
    highlight: { label: { en: "Golden window for prevention", ms: "Peluang emas pencegahan", zh: "预防的黄金窗口" }, value: "9.3%", color: "#1D9E75" },
    why: {
      en: "Bumiputera Sabah has the lowest diabetes rate at 9.3%, but hypertension at 29.2% and high cholesterol at 30.4% remain significant. These figures suggest that cardiovascular risk is already elevated even while diabetes remains lower — making this the best time to act before the numbers rise.",
      ms: "Bumiputera Sabah mempunyai kadar diabetes terendah pada 9.3%, tetapi hipertensi pada 29.2% dan kolesterol tinggi pada 30.4% masih ketara. Angka-angka ini menunjukkan bahawa risiko kardiovaskular sudah meningkat walaupun diabetes masih rendah — menjadikan ini masa terbaik untuk bertindak sebelum angka meningkat.",
      zh: "沙巴土著糖尿病率最低，为9.3%，但高血压29.2%和高胆固醇30.4%仍然不容忽视。这些数字表明，即使糖尿病率较低，心血管风险已经在上升——现在是在数字进一步攀升前采取行动的最佳时机。",
    },
    actions: {
      en: [
        "Use this low-risk window — get a baseline blood sugar, blood pressure, and cholesterol check now so you have numbers to compare in future.",
        "Maintain traditional diets rich in vegetables and fish where possible; avoid replacing them with processed convenience foods.",
        "Encourage family members to get screened too — early detection in the family protects everyone.",
      ],
      ms: [
        "Gunakan peluang risiko rendah ini — dapatkan pemeriksaan asas gula darah, tekanan darah, dan kolesterol sekarang supaya anda mempunyai angka untuk dibandingkan pada masa hadapan.",
        "Kekalkan diet tradisional yang kaya dengan sayur-sayuran dan ikan jika boleh; elak menggantikannya dengan makanan kemudahan yang diproses.",
        "Galakkan ahli keluarga untuk mendapatkan saringan juga — pengesanan awal dalam keluarga melindungi semua orang.",
      ],
      zh: [
        "利用这一低风险窗口期——现在进行基础血糖、血压和胆固醇检查，以便将来有数据进行比较。",
        "尽量保持富含蔬菜和鱼类的传统饮食，避免用加工便利食品替代。",
        "鼓励家庭成员也进行筛查——家庭中的早期发现可以保护所有人。",
      ],
    },
  },

  "Others": {
    highlight: { label: { en: "Lower overall risk", ms: "Risiko keseluruhan lebih rendah", zh: "整体风险较低" }, value: "10.2%", color: "#1D9E75" },
    why: {
      en: "The 'Others' group has a diabetes rate of 10.2%, with hypertension at 17.1% and high cholesterol at 24.4% — lower across all three conditions compared to other groups. However, these numbers still mean a meaningful portion of this community is affected, and regular screening remains important.",
      ms: "Kumpulan 'Lain-lain' mempunyai kadar diabetes 10.2%, dengan hipertensi pada 17.1% dan kolesterol tinggi pada 24.4% — lebih rendah merentas ketiga-tiga keadaan berbanding kumpulan lain. Walau bagaimanapun, angka-angka ini masih bermakna sebahagian besar komuniti ini terjejas, dan saringan berkala tetap penting.",
      zh: "\"其他\"族群糖尿病率10.2%，高血压17.1%，高胆固醇24.4%——三项指标均低于其他族群。然而，这些数字仍然意味着该社群中有相当一部分人受到影响，定期筛查仍然重要。",
    },
    actions: {
      en: [
        "Don't skip health screenings even with lower numbers — early detection is always easier to manage than late diagnosis.",
        "Maintain a balanced diet and regular physical activity to keep all three conditions in check.",
        "Know your family history — if a parent or sibling has diabetes or hypertension, your personal risk is higher regardless of community averages.",
      ],
      ms: [
        "Jangan langkau saringan kesihatan walaupun dengan angka yang lebih rendah — pengesanan awal sentiasa lebih mudah diurus daripada diagnosis lewat.",
        "Kekalkan diet seimbang dan aktiviti fizikal yang kerap untuk mengawal ketiga-tiga keadaan.",
        "Ketahui sejarah keluarga anda — jika ibu bapa atau adik-beradik menghidap diabetes atau hipertensi, risiko peribadi anda lebih tinggi tanpa mengira purata komuniti.",
      ],
      zh: [
        "即使数字较低，也不要跳过健康筛查——早期发现总是比晚期诊断更容易处理。",
        "保持均衡饮食和规律的体育活动，以控制三项指标。",
        "了解您的家族病史——如果父母或兄弟姐妹患有糖尿病或高血压，无论社群平均值如何，您的个人风险都会更高。",
      ],
    },
  },
}

const DEFAULT_EXPLANATION: EthnicityExplanation = {
  highlight: { label: { en: "Community data", ms: "Data komuniti", zh: "社群数据" }, value: "—", color: "#94a3b8" },
  why: {
    en: "Diabetes prevalence in this group is shaped by a mix of genetic, dietary, and lifestyle factors. It often appears alongside high blood pressure and high cholesterol, so understanding all three together gives the clearest picture of health risk.",
    ms: "Prevalens diabetes dalam kumpulan ini dibentuk oleh gabungan faktor genetik, pemakanan, dan gaya hidup. Ia sering muncul bersama tekanan darah tinggi dan kolesterol tinggi, jadi memahami ketiga-tiga faktor bersama memberikan gambaran risiko kesihatan yang paling jelas.",
    zh: "该群体的糖尿病患病率由遗传、饮食和生活方式等多种因素共同影响。它通常与高血压和高胆固醇同时出现，因此综合了解三者才能最清楚地评估健康风险。",
  },
  actions: {
    en: [
      "Get a full health screening covering blood sugar, blood pressure, and cholesterol.",
      "Eat balanced meals and aim for 30 minutes of activity most days.",
      "Talk to your doctor if you have a family history of any of the three highs.",
    ],
    ms: [
      "Dapatkan saringan kesihatan penuh yang merangkumi gula darah, tekanan darah, dan kolesterol.",
      "Makan makanan seimbang dan sasarkan 30 minit aktiviti pada kebanyakan hari.",
      "Bercakap dengan doktor anda jika anda mempunyai sejarah keluarga mana-mana daripada tiga tinggi.",
    ],
    zh: [
      "进行包括血糖、血压和胆固醇的全面健康筛查。",
      "均衡饮食，大多数日子争取30分钟的活动。",
      "如果您有三高家族病史，请与医生交流。",
    ],
  },
}

// ─── Stat card ────────────────────────────────────────────────────────────
interface StatCardProps {
  value: string
  label: string
  icon?: React.ElementType
  image?: string
  colors: { accent: string; iconBg: string; valueCss: string }
  nudge?: { text: string; link: string; href: string }
}

function StatCard({ value, label, icon: Icon, image, colors, nudge }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-background flex flex-col h-full"
      style={{ borderTop: `3px solid ${colors.accent}` }}
    >
      {/* Main stat row */}
      <div className="flex items-center gap-4 p-4 sm:p-5 flex-1">
        <div
          className="shrink-0 flex items-center justify-center rounded-full w-16 h-16"
          style={{ backgroundColor: colors.iconBg }}
        >
          {image ? (
            <div className="relative w-16 h-12">
              <Image src={image} alt={label} fill className="object-contain" />
            </div>
          ) : Icon ? (
            <Icon className="w-12 h-12" style={{ color: colors.valueCss }} />
          ) : null}
        </div>
        <div className="min-w-0">
          <div
            className="text-3xl md:text-4xl font-extrabold leading-tight"
            style={{ color: colors.valueCss }}
          >
            {value}
          </div>
          <div className="text-base md:text-lg text-muted-foreground font-medium leading-snug mt-0.5">
            {label}
          </div>
        </div>
      </div>

      {/* ── NEW: Nudge strip ── */}
      {nudge && (
        <div className="border-t border-border px-4 sm:px-5 py-3 flex items-center justify-between gap-3 bg-muted/40 min-h-[72px]">
          <p className="text-sm text-muted-foreground leading-snug">{nudge.text}</p>
          <Link
            href={nudge.href}
            className="shrink-0 text-sm font-semibold whitespace-nowrap"
            style={{ color: colors.valueCss }}
          >
            {nudge.link}
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Summary banner ──────────────────────────────────────────────────
function SummaryBanner({ t }: { t: typeof content.en }) {
  const stats = [
    { value: "1 in 5", label: t.stats[0].label },
    { value: "4.75M", label: t.stats[2].label },
    { value: "3 in 4", label: t.stats2[0].label },
  ]
  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 sm:p-6 space-y-4">
      {/* Why heading */}
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-primary" />
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">{t.summary_why}</h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{t.summary_body}</p>
        </div>
      </div>

      {/* Key stat pills — stacked on mobile, side by side on sm+ */}
      <div className="flex flex-col sm:flex-row gap-3">
        {stats.map((s, i) => (
          <div key={i} className="flex-1 bg-background rounded-xl border border-border p-3 text-center">
            <div className="text-2xl md:text-4xl font-extrabold text-primary">{s.value}</div>
            <div className="text-base md:text-lg text-muted-foreground mt-0.5 leading-snug">{s.label}</div>
          </div>
        ))}
      </div>

      {/* CTA buttons — full width on mobile */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Link
          href="/recommendation"
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t.summary_cta1} <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/learn"
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold border border-border bg-background hover:bg-muted transition-colors"
        >
          {t.summary_cta2}
        </Link>
      </div>
    </div>
  )
}

// ─── Trends chart and tooltip ────────────────────────────────────────────
function TrendTooltip({
  active,
  payload,
  label,
  t,
}: {
  active?: boolean
  payload?: { value?: unknown; }[]
  label?: number
  t: { tooltip_label: string; tooltip_label2: string; tooltip_label3: string }
}) {
  if (!active || !payload?.length) return null
  const [diabetesItem, hypertensionItem, hyperlipidemiaItem] = payload
  const diabetes = typeof diabetesItem?.value === "number" ? diabetesItem.value : 0
  const hypertension = typeof hypertensionItem?.value === "number" ? hypertensionItem.value : 0
  const hyperlipidemia = typeof hyperlipidemiaItem?.value === "number" ? hyperlipidemiaItem.value : 0
  return (
    <div style={{
      backgroundColor: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      padding: "12px 16px",
      fontSize: "18px",
    }}>
      <p style={{ fontWeight: "bold", fontSize: "20px", marginBottom: "8px", color: "var(--foreground)" }}>
        {label}
      </p>
      <p style={{ color: "#282626", marginBottom: "4px" }}>
        <span style={{ fontWeight: 300 }}>{t.tooltip_label}:</span>{" "}
        {diabetes.toFixed(1)}%
      </p>
      <p style={{ color: "#282626", marginBottom: "4px" }}>
        <span style={{ fontWeight: 300 }}>{t.tooltip_label2}:</span>{" "}
        {hypertension.toFixed(1)}%
      </p>
      <p style={{ color: "#282626", marginBottom: "4px" }}>
        <span style={{ fontWeight: 300 }}>{t.tooltip_label3}:</span>{" "}
        {hyperlipidemia.toFixed(1)}%
      </p>
    </div>
  )
}

// A line chart component showing trends in diabetes, hypertension, and hyperlipidemia over time, with a custom tooltip and legend.
function TrendsChart({ t, nationalTrend }: { t: typeof content.en; nationalTrend: NationalTrendRow[] }) {
  const chartData = [...nationalTrend]
    .sort((a, b) => a.year - b.year)
    .map(row => ({
      year: row.year,
      diabetes: parseFloat(row.diabetes as string), 
      hypertension: parseFloat(row.hypertension as string),
      hyperlipidemia: parseFloat(row.hyperlipidemia as string),
      patients: row.patients,
    }))

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-sm">
      <h2 className="text-2xl sm:text-3xl font-bold mb-1">{t.trends_title}</h2>
      <p className="text-lg text-muted-foreground mb-6">{t.trends_subtitle}</p>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ left: 15, right: 20, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fontSize: 20 }} />
          <YAxis
            yAxisId="prevalence"
            domain={[0, 50]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 18, fill: "#282626" }}
            label={{ value: t.trends_y_label, angle: -90, position: "insideLeft", offset: -5, style: { fontSize: 16, fill: "#282626" } }}
          />
          <Tooltip content={({ active, payload, label }) => <TrendTooltip active={active} payload={payload} label={label} t={t} />} />
          <Legend 
            verticalAlign="bottom" 
            height={50}
            iconType="circle"
            iconSize={14}
            formatter={(value) => {
              const labels: Record<string, string> = {
                diabetes: t.tooltip_label,
                hypertension: t.tooltip_label2,
                hyperlipidemia: t.tooltip_label3,
              };
              return (
                <span className="text-base font-medium px-2 text-foreground">
                  {labels[value] ||value.charAt(0).toUpperCase() + value.slice(1)}
                </span>
              )
            }}
            wrapperStyle={{
              paddingBottom: "20px",
              paddingLeft: "40px"
            }}
          />
          {/* Diabetes Line */}
          <Line
            yAxisId="prevalence"
            type="monotone"
            dataKey="diabetes"
            stroke="#4a7fc1"
            strokeWidth={3}
            dot={{ fill: "#4a7fc1", r: 5 }}
            activeDot={{ r: 8 }}
          />
          {/* Hypertension Line */}
          <Line
            yAxisId="prevalence"
            type="monotone"
            dataKey="hypertension"
            stroke="#e07b4a"
            strokeWidth={3}
            dot={{ fill: "#e07b4a", r: 5 }}
            activeDot={{ r: 8 }}
          />
          {/* Hyperlipidemia Line */}
          <Line
            yAxisId="prevalence"
            type="monotone"
            dataKey="hyperlipidemia"
            stroke="#e6da3e"
            strokeWidth={3}
            dot={{ fill: "#e6da3e", r: 5 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-4 text-lg border-l-4 border-amber-400 pl-4">
        {t.trends_note}
      </p>
    </div>
  )
}

// Colors for each ethnic group in the bar chart, chosen to be visually distinct and colorblind-friendly.
const ETHNICITY_COLORS = ["#56b4e9", "#e07b4a", "#0072b1", "#f03333", "#cc79a7", "#e6da3e"]

// A custom bar shape that applies both a solid color and an optional pattern overlay, with opacity adjustments based on selection state.
const CustomBarShape = (props: any) => {
  const { x, y, width, height, fill, patternId, payload, selected } = props;

  if (x == null || y == null || width == null || height == null ||
    isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height) ||
    width <= 0 || height <= 0  ) return null;

  // This part handles the "fading" effect when clicking an ethnicity
  const isSelected = !selected || selected.rawEthnicity === payload.rawEthnicity;
  const opacity = isSelected ? 1 : 0.3;

  return (
    <g>
      {/* Draw the Solid Color Bar */}
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={opacity} rx={6} ry={6} />
      
      {/* Draw the Pattern on top (if a patternId is provided) */}
      {patternId && (
        <rect x={x} y={y} width={width} height={height} fill={`url(#${patternId})`} fillOpacity={opacity} rx={6} ry={6} style={{ cursor: "pointer" }}/>
      )}
    </g>
  );
};

// A custom legend component that maps the bar to translated labels and includes visual indicators for the patterns used in the bars.
const CustomLegend = ({ payload, t }: { payload?: any[], t: typeof content.en }) => {
  if (!payload) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
      {payload.map((entry: any, index: number) => {
        // Map bar name to translation
        const label =
          entry.value === "Diabetes" ? t.tooltip_label :
          entry.value === "Hypertension" ? t.tooltip_label2 :
          entry.value === "Hyperlipidemia" ? t.tooltip_label3 :
          entry.value

        return (
          <div key={`item-${index}`} className="flex items-center gap-2">
            <svg width="20" height="20" className="rounded-sm">
              <rect width="20" height="20" fill="#94a3b8" />
              {entry.value === "Hypertension" && (
                <rect width="20" height="20" fill="url(#striped)" />
              )}
              {entry.value === "Hyperlipidemia" && (
                <rect width="20" height="20" fill="url(#dotted)" />
              )}
            </svg>
            <span className="text-base font-medium text-foreground">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// A custom hook to determine if the screen width is below a certain breakpoint, used for responsive design adjustments in the bar chart.
function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < breakpoint)
      check()
      window.addEventListener("resize", check)
      return () => window.removeEventListener("resize", check)
    }, [breakpoint])
    return isMobile
  }

// A bar chart component that displays three highs prevalence of each ethnic group
function EthnicityBarChart({t, ethnicityData,}: {t: typeof content.en; ethnicityData: EthnicityRow[]}) {
  const chartData = ethnicityData.map((row) => ({
    rawEthnicity: row.ethnicity,
    ethnicity: t.ethnicity_names[row.ethnicity as keyof typeof t.ethnicity_names] ?? row.ethnicity, // aliased column holds the ethnicity name
    diabetes: parseFloat(row.diabetes as string), 
    hypertension: parseFloat(row.hypertension as string),
    hyperlipidemia: parseFloat(row.hyperlipidemia as string),
  }))
  .sort((a, b) => b.diabetes - a.diabetes)

  const [selected, setSelected] = useState<{ rawEthnicity: string; diabetes: number, hypertension: number, hyperlipidemia: number } | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<EthnicityExplanation | null>(null)
  const explanationRef = useRef<HTMLDivElement>(null)

  // Determine language code based on the title translation, defaulting to English if it doesn't match known translations
  const langCode = t.ethnicity_title === "Health in Our Communities" ? "en"
    : t.ethnicity_title === "Kesihatan dalam Komuniti Kita" ? "ms"
    : "zh"

  const whatYouCanDo = langCode === "ms" ? "Apa yang boleh anda lakukan"
    : langCode === "zh" ? "您可以做什么"
    : "What you can do"
  
  // When a bar is clicked, toggle selection and update the explanation text based on the selected
  function handleBarClick(data: { rawEthnicity: string; ethnicity: string; diabetes: number, hypertension: number, hyperlipidemia: number }) {
    // If clicking the same bar, deselect it
    if (selected?.rawEthnicity === data.rawEthnicity) {
      setSelected(null)
      setSelectedEntry(null)
      return
    }
    setSelected({ rawEthnicity: data.rawEthnicity, diabetes: data.diabetes, hypertension: data.hypertension, hyperlipidemia: data.hyperlipidemia })
    setSelectedEntry(ETHNICITY_EXPLANATIONS[data.rawEthnicity] ?? DEFAULT_EXPLANATION)
  }

    // scroll to state details when a state is selected
    useEffect(() => {
      if (selectedEntry) {
        const timer = setTimeout(() => {
          explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }, [selectedEntry]);

  const isMobile = useIsMobile()
  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-sm mt-6">
      <h2 className="text-2xl sm:text-3xl font-bold mb-1">{t.ethnicity_title}</h2>
      <p className="text-xl text-foreground mb-6">{t.ethnicity_subtitle1}</p>
      <p className="text-lg text-muted-foreground mb-6">{t.ethnicity_subtitle}</p>

      <ResponsiveContainer width="100%" height={600}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40, top: 20, bottom: 10}}>
          <defs>
            {/* Striped Pattern for Hypertension */}
            <pattern id="striped" width="15" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2" height="8" fill="white" fillOpacity="0.8" />
            </pattern>
            {/* Dotted Pattern for Hyperlipidemia */}
            <pattern id="dotted" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="8" cy="8" r="3" fill="white" fillOpacity="0.8" />
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="3 3" horizontal={!false} vertical={true} />
          <XAxis
            type="number"
            domain={[0, 45]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 14 }}
            label = {{ value: t.ethnicity_y_label, offset: -5, position: "insideBottom" }}
          />
          <YAxis
            type="category"
            dataKey="ethnicity"
            width={isMobile ? 0 : 90}
            tick={isMobile ? false :{ fontSize: 16 }}
          />
          <Tooltip
            cursor={{ fill: "transparent" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const { ethnicity, diabetes, hypertension, hyperlipidemia } = payload[0].payload
              return (
                <div style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  fontSize: "16px",
                  minWidth: "180px",
                }}>
                  <p style={{ fontWeight: 700, marginBottom: "8px", color: "var(--foreground)" }}>{ethnicity}</p>
                  <p style={{ color: "var(--muted-foreground)", marginBottom: "4px" }}>
                    {t.tooltip_label}: <strong>{diabetes.toFixed(1)}%</strong>
                  </p>
                  <p style={{ color: "var(--muted-foreground)", marginBottom: "4px" }}>
                    {t.tooltip_label2}: <strong>{hypertension.toFixed(1)}%</strong>
                  </p>
                  <p style={{ color: "var(--muted-foreground)" }}>
                    {t.tooltip_label3}: <strong>{hyperlipidemia.toFixed(1)}%</strong>
                  </p>
                </div>
              )
            }}
          />
          <Legend content={(props) => <CustomLegend {...props} t={t} />} verticalAlign="top" align="right" />
          {/* Group 1: Diabetes (Solid) */}
          <Bar dataKey="diabetes" name="Diabetes" radius={[0, 6, 6, 0]} maxBarSize={80} onClick={(data) => handleBarClick(data as {rawEthnicity: string; ethnicity: string; diabetes: number; hypertension: number; hyperlipidemia: number })} style={{ cursor: "pointer" }}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-dia-${index}`} fill={ETHNICITY_COLORS[index % ETHNICITY_COLORS.length]} opacity={selected && selected.rawEthnicity !== entry.ethnicity ? 0.35 : 1} />
            ))}
          </Bar>
          {/* Group 2: Hypertension (Striped) */}
          <Bar dataKey="hypertension" name="Hypertension" shape={<CustomBarShape patternId="striped" selected={selected} />} onClick={(data) => handleBarClick(data as { rawEthnicity: string; ethnicity: string; diabetes: number; hypertension: number; hyperlipidemia: number })} style={{ cursor: "pointer" }}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-hyp-${index}`} fill={ETHNICITY_COLORS[index % ETHNICITY_COLORS.length]} fillOpacity={selected && selected.rawEthnicity !== entry.ethnicity ? 0.3 : 1} />
            ))}
            
          </Bar>

          {/* Group 3: Hyperlipidemia (Dotted) */}
          <Bar dataKey="hyperlipidemia" name="Hyperlipidemia" shape={<CustomBarShape patternId="dotted" selected={selected} />} onClick={(data) => handleBarClick(data as { rawEthnicity: string; ethnicity: string; diabetes: number; hypertension: number; hyperlipidemia: number })} style={{ cursor: "pointer" }}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-lip-${index}`} fill={ETHNICITY_COLORS[index % ETHNICITY_COLORS.length]} fillOpacity={selected && selected.rawEthnicity !== entry.ethnicity ? 0.3 : 1} />
            ))}
            
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Colour legend */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
        {chartData.map((entry, index) => (
          <button key={index} onClick={() => handleBarClick(entry)} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: ETHNICITY_COLORS[index % ETHNICITY_COLORS.length] }}
            />
            <span className="text-lg text-muted-foreground">{entry.ethnicity}</span>
          </button>
        ))}
      </div>

      {/* Explanation panel — three-part structure */}
      {selected && selectedEntry && (() => {
        const color = ETHNICITY_COLORS[chartData.findIndex((d) => d.rawEthnicity === selected.rawEthnicity) % ETHNICITY_COLORS.length]
        const highlight = selectedEntry.highlight
        const why = selectedEntry.why[langCode]
        const actions = selectedEntry.actions[langCode]
        return (
          <div ref={explanationRef} className="mt-6 scroll-mt-6 rounded-2xl overflow-hidden border border-border shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: color }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔍</span>
                <div>
                  <p className="text-white font-bold text-xl leading-tight">{t.ethnicity_names[selected?.rawEthnicity as keyof typeof t.ethnicity_names] ?? selected?.rawEthnicity}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelected(null); setSelectedEntry(null) }}
                className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/20"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mini stats row — all three highs */}
            <div className="grid max-[425px]:grid-cols-1 grid-cols-2 sm:grid-cols-3 divide-x divide-gray-200">
              {[
                { label: t.tooltip_label,  value: selected.diabetes },
                { label: t.tooltip_label2, value: selected.hypertension },
                { label: t.tooltip_label3, value: selected.hyperlipidemia },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-3 text-center">
                  <p className="text-base font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                  <p className="text-3xl font-bold text-foreground">{value.toFixed(1)}%</p>
                </div>
              ))}
            </div>

            {/* Highlight badge */}
            <div className="px-5 pt-4 pb-1 bg-card">
              <span
                className="inline-flex items-center gap-1.5 text-base font-semibold rounded-full px-3 py-1 mb-3"
                style={{ backgroundColor: selectedEntry.highlight.color + "20", color: selectedEntry.highlight.color }}
              >
                ★ {highlight.label[langCode]}: {highlight.value}
              </span>
            </div>

            {/* Why */}
            <div className="px-5 pb-3 bg-card">
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{why}</p>
            </div>

            {/* What you can do */}
            <div className="px-5 pt-3 pb-5 bg-card border-t border-border">
              <p className="text-base font-semibold uppercase tracking-widest text-muted-foreground mb-3">{whatYouCanDo}</p>
              <ul className="space-y-3">
                {actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5"
                      style={{ backgroundColor: color }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-lg text-foreground leading-snug">{action}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })()}

      {/* Tap hint, only shown before any selection */}
      {!selected && (
        <p className="text-center text-lg text-muted-foreground mt-5">
          {t.click_bar}
        </p>
      )}
    </div>
  )
}

export default function StatisticsClient({ dataByYear, availableYears, nationalTrend, ethnicityData }: StatisticsClientProps) {
  const [activeTab, setActiveTab] = useState<"prevalence" | "trends">("prevalence")

  return (
    <PageLayout>
      {(lang) => {
        const t = content[lang]
        return (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-10">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-2xl md:text-5xl font-extrabold mb-4 text-balance">{t.page_title}</h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto whitespace-normal">{t.page_subtitle}</p>
            </div>

            <SummaryBanner t={t} />

            {/* ── Stats section ── */}
            <section className="py-8 md:py-10">
              {/* Eyebrow + heading */}
              <h2 className="text-2xl md:text-3xl font-bold mb-6 text-balance">
                {t.stats_heading}
              </h2>
              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-lg font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  {t.stats_eyebrow}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Diabetes cards — responsive 1 col on mobile, 3 on sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {t.stats.map((stat, i) => (
                  <StatCard
                    key={i}
                    value={stat.value}
                    label={stat.label}
                    icon={"icon" in stat ? stat.icon : undefined}
                    image={"image" in stat ? stat.image : undefined}
                    colors={STAT_COLORS[i % STAT_COLORS.length]}
                    nudge={t.stat_nudge[i]}
                  />
                ))}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-lg font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  {t.stats_title2}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Three Highs cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {t.stats2.map((stat, i) => (
                  <StatCard
                    key={i}
                    value={stat.value}
                    label={stat.label}
                    icon={"icon" in stat ? stat.icon : undefined}
                    colors={STAT2_COLORS[i % STAT2_COLORS.length]}
                  />
                ))}
              </div>
            </section>

            {/* Tab hint */}
            <div>
              <p className="text-base md:text-base mb-1 text-center">{t.tab_hints}</p>
            </div>

            {/* Tab Buttons - Large for elderly */}
            <div className="flex justify-center border-b border-border -mt-4">
              {(["prevalence", "trends"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 sm:px-10 py-3 text-lg font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "prevalence" ? t.tab_prevalence : t.tab_trends}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "prevalence" ? (
              <MalaysiaChoroplethMap t={t} lang={lang} dataByYear={dataByYear} availableYears={availableYears} />  
            ) : (
              <TrendsChart t={t} nationalTrend={nationalTrend} />
            )}

            {/* Ethnicity Bar Chart */}
            <EthnicityBarChart t={t} ethnicityData={ethnicityData} />
            
            {/* ── Did you know — insights cards ── */}
            <ThreeHighsInsights lang={lang} />

            {/* Disclaimer */}
            <div className="bg-warning/10 border border-warning/20 rounded-2xl p-5 flex gap-4">
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <p className="text-lg font-medium text-foreground">{t.disclaimer_text}</p>
            </div>

            {/* ── Menu scan CTA ── */}
            <MenuScanCTA lang={lang} variant="statistics"/>
          </div>
        )
      }}
    </PageLayout>
  )
}
