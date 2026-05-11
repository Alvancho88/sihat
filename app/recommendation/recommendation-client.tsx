// app/recommendation/recommendation-client.tsx
// Frontend UI for food analysis and recommendation system
// Handles image upload, text input, and displays AI-powered nutritional analysis
// Supports multi-language interface and real-time progress tracking

"use client"

import { PageLayout } from "@/components/page-layout"
import { useCart } from "@/components/cart-context"
import { useState, useRef, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import type { FoodItem as MealPlanFoodItem } from "@/lib/food-functions"

import Image from "next/image"
import {
  Camera, Upload, X, Star, TrendingDown, TrendingUp, Minus, Split,
  CheckCircle, Info, Loader2, ZoomIn, Utensils, GlassWater, Cake, Salad, Plus, Trash2, ArrowRight, ImageIcon
} from "lucide-react"

// Define language codes for multi-language support
type LangCode = "en" | "ms" | "zh"

// ─── MULTI-LANGUAGE CONTENT ───────────────────────────────────────────────────────
 
// Comprehensive content object supporting English, Malay, and Chinese
// Contains all UI text, labels, and messages for internationalization
const content = {
  en: {
    page_title: "Food Check & Recommendation",
    page_subtitle: "Simple photos, smarter choices. Take control of your health today.",
    guide_title: "How to Take a Good Photo",
    guide_steps: [
      { icon: "camera", text: "Hold your phone steady above the menu" },
      { icon: "light", text: "Make sure there is good lighting" },
      { icon: "food", text: "If there is too much menu items in one photo, take it separately" },
      { icon: "clear", text: "Ensure the text is clearly visible" },
    ],
    upload_title: "Upload or Take Photo",
    upload_hint: "Tap to upload or take a photo of your menu",
    upload_btn: "Add Photo",
    camera_btn: "Take Photo",
    uploading: "Uploading...",
    click_to_view: "Click to view full image",
    text_input_title: "Type Your Food Name",
    text_input_hint: "No photo? Type the dish name here instead. Separate each item with comma.",
    text_placeholder: "E.g., Nasi lemak, Roti canai, Teh tarik...",
    analyze_btn: "Analyse & Recommend",
    select_category: "Select Food Category",
    select_category_hint: "Choose which type of food you want to analyse:",
    categories: {
      appetizer: "Appetizer",
      main: "Main Dish",
      dessert: "Dessert",
      drink: "Drinks",
    },
    result_title: "Analysis Result",
    best_choice: "Best Choice",
    disclaimer: "Ranking based on estimated Sugar, Salt, and Saturated Fat levels. Results are for general guidance only and should not replace professional medical advice.",
    tip_label: "Health Tip",
    risk_low: "Low Risk",
    risk_medium: "Medium Risk",
    risk_high: "High Risk",
    nutrition_sugar: "Sugar",
    nutrition_salt: "Salt/Sodium",
    nutrition_fat: "Saturated Fat",
    analyze_another: "Back",
    back_to_upload: "Upload New Photo",
    max_photos: "Maximum 5 Photos",
    max_photos_warning: "You have reached the limit of 5 photos. Please remove a photo to add more.",
    photos_count: "photos",
    delete_all: "Delete All",
    common_foods_title: "Popular Malaysian Foods",
    common_foods_subtitle: "Click any food for more info",
    see_more_foods: "See More Foods",
    gi_guide_title: "Glycemic Index Guide",
    gi_description: "GI measures how fast food raises blood sugar.",
    gi_short_explanation: "GI shows how quickly food raises your blood sugar level.",
    gi_popup_title: "What is Glycemic Index (GI)?",
    gi_popup_description: "The Glycemic Index (GI) is a rating system that measures how quickly foods containing carbohydrates affect your blood sugar levels. Foods are ranked on a scale of 0 to 100, with pure glucose being 100. Understanding GI is especially important for people with diabetes or those managing their blood sugar levels.",
    gi_popup_why_important: "Why is GI Important?",
    gi_popup_importance: "Choosing low GI foods can help: maintain steady blood sugar levels, reduce risk of diabetes complications, control appetite and manage weight, and provide sustained energy throughout the day.",
    gi_low: "Low GI (0-55)",
    gi_medium: "Medium GI (56-69)",
    gi_high: "High GI (70+)",
    sugar_guide_title: "Sugar Guide",
    sugar_low: "Low (<5g)",
    sugar_medium: "Medium (5-15g)",
    sugar_high: "High (>15g)",
    portion: "Serving",
    tip_label_full: "Health Tip",
    close: "Close",
    daily_sugar_title: "Daily Sugar Limit:",
    daily_sugar_women: "Women < 25g",
    daily_sugar_men: "Men < 36g",
    unrecognized_title: "Some items could not be recognized",
    unrecognized_hint: "Try uploading a clearer image or describe the food in the text box.",
    no_results: "No food items detected",
    no_results_hint: "Please upload a clearer photo of the menu or describe your food.",
    scanning_steps: ["Reading menu...", "Identifying food items...", "Calculating nutrition values...", "Almost done..."],
    success_found: "items found!",
    success_none: "No items detected",
    top3_disclaimer: "We are showing you the Top 3 Healthiest Choices identified in your photo. These are the safest options for managing your blood sugar, blood pressure, and cholesterol.",
    analyze_new_food: "Reset",
    back_to_category: "Back to Categories",
    best_choice_reason_label: "Why we pick this as the Best Choice",
    add_to_meal_plan: "Add to Meal Plan",
    in_meal_plan: "In Meal Plan",
    added_to_meal_plan: "Added to your meal plan",
    removed_from_meal_plan: "Removed from your meal plan",
    meal_plan_unavailable: "Meal planning unavailable",
    meal_plan_unavailable_hint: "This food is not yet available in the meal planner.",
    // Action sheet
    sheet_title: "Add Photo",
    sheet_camera: "Take Photo",
    sheet_gallery: "Choose from Gallery",
    sheet_cancel: "Cancel",
  },
  ms: {
    page_title: "Semak & Cadangan Makanan",
    page_subtitle: "Foto mudah, pilihan bijak. Urus kesihatan anda dengan lebih yakin.",
    guide_title: "Cara Mengambil Foto yang Baik",
    guide_steps: [
      { icon: "camera", text: "Pegang telefon anda dengan stabil di atas makanan" },
      { icon: "light", text: "Pastikan pencahayaan yang baik" },
      { icon: "split", text: "Masukkan semua hidangan dalam satu foto" },
      { icon: "clear", text: "Pastikan makanan jelas kelihatan" },
    ],
    upload_title: "Muat Naik atau Ambil Foto",
    upload_hint: "Ketik untuk muat naik atau ambil foto makanan anda",
    upload_btn: "Tambah Foto",
    camera_btn: "Ambil Foto",
    uploading: "Memuat naik...",
    click_to_view: "Klik untuk lihat imej penuh",
    text_input_title: "Taip Nama Makanan Anda",
    text_input_hint: "Tiada foto? Taip nama hidangan di sini. Pisahkan setiap item dengan koma.",
    text_placeholder: "Cth., Nasi lemak, Roti canai, Teh tarik...",
    analyze_btn: "Analisis & Cadangan",
    select_category: "Pilih Kategori Makanan",
    select_category_hint: "Pilih jenis makanan yang ingin anda analisis:",
    categories: {
      appetizer: "Pembuka Selera",
      main: "Hidangan Utama",
      dessert: "Pencuci Mulut",
      drink: "Minuman",
    },
    result_title: "Keputusan Analisis",
    best_choice: "Pilihan Terbaik",
    disclaimer: "Penarafan berdasarkan anggaran gula, kalori dan nilai GI. Keputusan adalah untuk panduan umum sahaja.",
    tip_label: "Tip Kesihatan",
    risk_low: "Risiko Rendah",
    risk_medium: "Risiko Sederhana",
    risk_high: "Risiko Tinggi",
    nutrition_sugar: "Gula",
    nutrition_salt: "Garam/Natrium",
    nutrition_fat: "Lemak Tepu",
    analyze_another: "Kembali",
    back_to_upload: "Muat Naik Foto Baru",
    max_photos: "Maksimum 5 Foto",
    max_photos_warning: "Anda telah mencapai had 5 foto. Sila buang foto untuk menambah lagi.",
    photos_count: "foto",
    delete_all: "Padam Semua",
    common_foods_title: "Makanan Malaysia Popular",
    common_foods_subtitle: "Klik mana-mana makanan untuk maklumat lanjut",
    see_more_foods: "Lihat Lebih Banyak Makanan",
    gi_guide_title: "Panduan Indeks Glisemik",
    gi_description: "GI mengukur seberapa cepat makanan meningkatkan gula darah.",
    gi_short_explanation: "GI menunjukkan seberapa cepat makanan menaikkan gula darah anda.",
    gi_popup_title: "Apakah Indeks Glisemik (GI)?",
    gi_popup_description: "Indeks Glisemik (GI) adalah sistem penilaian yang mengukur seberapa cepat makanan yang mengandungi karbohidrat mempengaruhi paras gula darah anda. Makanan dinilai pada skala 0 hingga 100, dengan glukosa tulen adalah 100. Memahami GI amat penting bagi penghidap diabetes atau mereka yang mengawal paras gula darah.",
    gi_popup_why_important: "Mengapa GI Penting?",
    gi_popup_importance: "Memilih makanan GI rendah boleh membantu: mengekalkan paras gula darah yang stabil, mengurangkan risiko komplikasi diabetes, mengawal selera dan mengurus berat badan, serta memberikan tenaga yang berterusan sepanjang hari.",
    gi_low: "GI Rendah (0-55)",
    gi_medium: "GI Sederhana (56-69)",
    gi_high: "GI Tinggi (70+)",
    sugar_guide_title: "Panduan Gula",
    sugar_low: "Rendah (<5g)",
    sugar_medium: "Sederhana (5-15g)",
    sugar_high: "Tinggi (>15g)",
    portion: "Sajian",
    tip_label_full: "Tip Kesihatan",
    close: "Tutup",
    daily_sugar_title: "Had Gula Harian:",
    daily_sugar_women: "Wanita < 25g",
    daily_sugar_men: "Lelaki < 36g",
    unrecognized_title: "Beberapa item tidak dapat dikenalpasti",
    unrecognized_hint: "Cuba muat naik imej yang lebih jelas atau terangkan makanan dalam kotak teks.",
    no_results: "Tiada item makanan dikesan",
    no_results_hint: "Sila muat naik foto menu yang lebih jelas atau terangkan makanan anda.",
    scanning_steps: ["Membaca menu...", "Mengenal pasti item makanan...", "Mengira nilai nutrisi...", "Hampir selesai..."],
    success_found: "item dijumpai!",
    success_none: "Tiada item dikesan",
    top3_disclaimer: "Kami menunjukkan kepada anda 3 Pilihan Paling Sihat daripada apa yang dijumpai dalam foto makanan anda. Ini adalah pilihan paling selamat untuk gula darah anda.",
    analyze_new_food: "Set Semula",
    back_to_category: "Kembali ke Kategori",
    best_choice_reason_label: "Kenapa Pilihan Terbaik",
    add_to_meal_plan: "Tambah ke Pelan Makanan",
    in_meal_plan: "Dalam Pelan Makanan",
    added_to_meal_plan: "Ditambah ke pelan makanan anda",
    removed_from_meal_plan: "Dikeluarkan daripada pelan makanan anda",
    meal_plan_unavailable: "Perancangan makanan tidak tersedia",
    meal_plan_unavailable_hint: "Makanan ini belum tersedia dalam perancang makanan.",
    sheet_title: "Tambah Foto",
    sheet_camera: "Ambil Foto",
    sheet_gallery: "Pilih dari Galeri",
    sheet_cancel: "Batal",
  },
  zh: {
    page_title: "食物检查与推荐",
    page_subtitle: "简单拍照，智选三餐。掌控健康，就从今天开始。",
    guide_title: "如何拍摄好照片",
    guide_steps: [
      { icon: "camera", text: "将手机稳定地放在食物上方" },
      { icon: "light", text: "确保光线充足" },
      { icon: "split", text: "将所有菜肴放在一张照片中" },
      { icon: "clear", text: "确保食物清晰可见" },
    ],
    upload_title: "上传或拍照",
    upload_hint: "点击上传或拍摄您的餐食照片",
    upload_btn: "添加照片",
    camera_btn: "拍照",
    uploading: "上传中...",
    click_to_view: "点击查看大图",
    text_input_title: "输入食物名称",
    text_input_hint: "没有照片？在这里输入菜名。用逗号分隔每个项目。",
    text_placeholder: "例如：椰浆饭、印度煎饼、拉茶...",
    analyze_btn: "分析推荐",
    select_category: "选择食物类别",
    select_category_hint: "选择您想分析的食物类型：",
    categories: {
      appetizer: "前菜",
      main: "主食",
      dessert: "甜点",
      drink: "饮料",
    },
    result_title: "分析结果",
    best_choice: "最佳选择",
    disclaimer: "排名基于估计的糖分、卡路里和GI值。结果仅供一般指导。",
    tip_label: "健康提示",
    risk_low: "低风险",
    risk_medium: "中等风险",
    risk_high: "高风险",
    nutrition_sugar: "糖分",
    nutrition_salt: "盐/钠",
    nutrition_fat: "饱和脂肪",
    analyze_another: "返回",
    back_to_upload: "上传新照片",
    max_photos: "最多5张照片",
    max_photos_warning: "您已达到5张照片的限制。请删除照片以添加更多。",
    photos_count: "张照片",
    delete_all: "删除全部",
    common_foods_title: "热门马来西亚美食",
    common_foods_subtitle: "点击任意食物获取更多信息",
    see_more_foods: "查看更多食物",
    gi_guide_title: "升糖指数指南",
    gi_description: "GI衡量食物升高血糖的速度。",
    gi_short_explanation: "GI显示食物提高血糖水平的速度。",
    gi_popup_title: "什么是升糖指数（GI）？",
    gi_popup_description: "升糖指数（GI）是一个评级系统，用于衡量含碳水化合物的食物对血糖水平的影响速度。食物按0到100的等级排名，纯葡萄糖为100。了解GI对于糖尿病患者或需要管理血糖水平的人尤为重要。",
    gi_popup_why_important: "为什么GI很重要？",
    gi_popup_importance: "选择低GI食物可以帮助：保持稳定的血糖水平、降低糖尿病并发症风险、控制食欲和管理体重，以及全天提供持续的能量。",
    gi_low: "低GI (0-55)",
    gi_medium: "中GI (56-69)",
    gi_high: "高GI (70+)",
    sugar_guide_title: "糖分指南",
    sugar_low: "低 (<5g)",
    sugar_medium: "中 (5-15g)",
    sugar_high: "高 (>15g)",
    portion: "份量",
    tip_label_full: "健康提示",
    close: "关闭",
    daily_sugar_title: "每日糖分限制:",
    daily_sugar_women: "女性 < 25g",
    daily_sugar_men: "男性 < 36g",
    unrecognized_title: "部分食物无法识别",
    unrecognized_hint: "请上传更清晰的图片或在文本框中描述食物。",
    no_results: "未检测到食物",
    no_results_hint: "请上传更清晰的菜单照片或描述您的食物。",
    scanning_steps: ["正在读取菜单...", "正在识别食物...", "正在计算营养值...", "即将完成..."],
    success_found: "个食物已找到！",
    success_none: "未检测到食物",
    top3_disclaimer: "我们为您展示了食物照片中发现的前3个最健康的选择。这些是对您血糖最安全的选项。",
    analyze_new_food: "重置",
    back_to_category: "返回类别",
    best_choice_reason_label: "为何是最佳选择",
    add_to_meal_plan: "加入饮食计划",
    in_meal_plan: "已在饮食计划中",
    added_to_meal_plan: "已加入您的饮食计划",
    removed_from_meal_plan: "已从饮食计划中移除",
    meal_plan_unavailable: "暂不能加入饮食计划",
    meal_plan_unavailable_hint: "这个食物暂时还没有在饮食规划中提供。",
    sheet_title: "添加照片",
    sheet_camera: "拍照",
    sheet_gallery: "从相册选择",
    sheet_cancel: "取消",
  },
}

function RiskBadge({ risk, t }: { risk: string; t: typeof content.en }) {
  const configs = {
    low: { label: t.risk_low, icon: TrendingDown, bg: "bg-[var(--risk-low-bg)]", text: "text-[var(--risk-low)]", border: "border-[var(--risk-low)]/30" },
    medium: { label: t.risk_medium, icon: Minus, bg: "bg-[var(--risk-medium-bg)]", text: "text-[var(--risk-medium)]", border: "border-[var(--risk-medium)]/30" },
    high: { label: t.risk_high, icon: TrendingUp, bg: "bg-[#FFF3CD]", text: "text-[#856404]", border: "border-[#856404]/30" },
  }
  const c = configs[risk as keyof typeof configs] || configs.medium
  const isHigh = risk === "high"
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border ${c.bg} ${c.text} ${c.border} ${isHigh ? "font-extrabold" : ""}`}>
      <c.icon className="w-4 h-4" />
      {c.label}
    </span>
  )
}

function getLevelFromThresholds(value: number, lowMax: number, mediumMax: number): "low" | "medium" | "high" {
  if (value <= lowMax) return "low"
  if (value <= mediumMax) return "medium"
  return "high"
}

function computeRiskFromIndicators(sugar: number, salt: number, fat: number, apiRisk: string): "low" | "medium" | "high" {
  if (!isNaN(sugar) && !isNaN(salt) && !isNaN(fat)) {
    const sugarLevel = getLevelFromThresholds(sugar, 5, 15)
    const saltLevel = getLevelFromThresholds(salt, 200, 600)
    const fatLevel = getLevelFromThresholds(fat, 3, 7)
    if (sugarLevel === "high" || saltLevel === "high" || fatLevel === "high") return "high"
    if (sugarLevel === "medium" || saltLevel === "medium" || fatLevel === "medium") return "medium"
    return "low"
  }
  return (apiRisk?.toLowerCase() as "low" | "medium" | "high") ?? "medium"
}

function indicatorClass(level: "low" | "medium" | "high") {
  if (level === "high") return "bg-[#FFF3CD] border border-[#856404]/30 text-[#856404]" 
  if (level === "medium") return "bg-[var(--risk-medium-bg)] border border-[var(--risk-medium)]/40 text-[var(--risk-medium)]"
  return "bg-muted text-foreground"
}

type FoodItem = {
  name: string
  risk: string
  sugar: string
  salt: string
  fat: string
  tip: { en: string; ms: string; zh: string }
  best_reason?: { en: string; ms: string; zh: string }
}

function FoodResultCard({
  food,
  isBest,
  t,
  lang,
  mealPlanFood,
}: {
  food: FoodItem
  isBest: boolean
  t: typeof content.en
  lang: LangCode
  mealPlanFood: MealPlanFoodItem | null
}) {
  const { cart, addToCart, removeFromCart } = useCart()
  const [mealPlanNotice, setMealPlanNotice] = useState("")
  const sugarValue = parseFloat(food.sugar.replace(/[^0-9.]/g, ""))
  const saltValue = parseFloat(food.salt.replace(/[^0-9.]/g, ""))
  const fatValue = parseFloat(food.fat.replace(/[^0-9.]/g, ""))
  const sugarLevel = getLevelFromThresholds(sugarValue, 5, 15)
  const saltLevel = getLevelFromThresholds(saltValue, 200, 600)
  const fatLevel = getLevelFromThresholds(fatValue, 3, 7)
  const tipText = food.tip[lang] || food.tip.en
  const bestReasonText = food.best_reason ? (food.best_reason[lang] || food.best_reason.en) : null
  const computedRisk = computeRiskFromIndicators(sugarValue, saltValue, fatValue, food.risk)
  const isHighRisk = computedRisk === "high"
  const isMediumRisk = computedRisk === "medium"
  const mealPlanIndex = mealPlanFood ? cart.findIndex((item) => item.name.en === mealPlanFood.name.en) : -1
  const mealPlanAdded = mealPlanIndex !== -1

  const handleToggleMealPlan = () => {
    if (!mealPlanFood) return
    if (mealPlanAdded) {
      removeFromCart(mealPlanIndex)
      setMealPlanNotice(t.removed_from_meal_plan)
    } else {
      addToCart(mealPlanFood)
      setMealPlanNotice(t.added_to_meal_plan)
    }
    window.setTimeout(() => setMealPlanNotice(""), 2200)
  }

  return (
    <div className={`bg-card rounded-2xl border-2 shadow-sm overflow-hidden ${isBest ? "border-primary" : "border-border"}`}>
      {isBest && (
        <div className="bg-primary px-4 py-2 flex items-center gap-2">
          <Star className="w-5 h-5 text-primary-foreground" />
          <span className="text-primary-foreground font-bold text-base">{t.best_choice}</span>
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold">{food.name}</h3>
          <RiskBadge risk={computedRisk} t={t} />
        </div>
        {isBest && bestReasonText && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
            <p className="text-base text-primary font-semibold">
              <span className="font-bold">{t.best_choice_reason_label}:</span> {bestReasonText}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-4 mb-4 text-base">
          <div className={`rounded-xl px-4 py-2 ${indicatorClass(sugarLevel)}`}>
            <span className="font-semibold text-foreground">{t.nutrition_sugar}:</span>
            <span className={`ml-1 ${sugarLevel !== "low" ? "font-extrabold" : ""}`}>{food.sugar}</span>
          </div>
          <div className={`rounded-xl px-4 py-2 ${indicatorClass(saltLevel)}`}>
            <span className="font-semibold text-foreground">{t.nutrition_salt}:</span>
            <span className={`ml-1 ${saltLevel !== "low" ? "font-extrabold" : ""}`}>{food.salt}</span>
          </div>
          <div className={`rounded-xl px-4 py-2 ${indicatorClass(fatLevel)}`}>
            <span className="font-semibold text-foreground">{t.nutrition_fat}:</span>
            <span className={`ml-1 ${fatLevel !== "low" ? "font-extrabold" : ""}`}>{food.fat}</span>
          </div>
        </div>
        <div className={`flex items-start gap-2 rounded-xl p-4 ${
          isHighRisk
            ? "bg-[#FFF3CD] border border-[#856404]/30"
            : "bg-accent/20"
        }`}>
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-accent-foreground" />
          <p className={`text-base text-foreground ${isHighRisk ? "font-bold" : ""}`}>
            <span className="font-bold">{t.tip_label}:</span> {tipText}
          </p>
        </div>
        <div className="mt-4">
          {mealPlanFood ? (
            <button
              type="button"
              onClick={handleToggleMealPlan}
              className={`w-full min-h-14 rounded-xl px-4 py-3 text-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                mealPlanAdded
                  ? "bg-emerald-50 text-emerald-800 border-2 border-emerald-300 hover:bg-emerald-100"
                  : "bg-primary text-primary-foreground hover:opacity-90 border-2 border-primary"
              }`}
              aria-pressed={mealPlanAdded}
            >
              {mealPlanAdded ? <CheckCircle className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {mealPlanAdded ? t.in_meal_plan : t.add_to_meal_plan}
            </button>
          ) : (
            <div>
              <button
                type="button"
                disabled
                className="w-full min-h-14 rounded-xl px-4 py-3 text-lg font-bold flex items-center justify-center gap-2 bg-slate-100 text-slate-600 border-2 border-slate-200 cursor-not-allowed"
              >
                <Info className="w-5 h-5" />
                {t.meal_plan_unavailable}
              </button>
              <p className="mt-2 text-sm font-medium text-slate-600">{t.meal_plan_unavailable_hint}</p>
            </div>
          )}
          {mealPlanNotice && (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-base font-semibold text-emerald-800" role="status">
              {mealPlanNotice}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function compressImage(file: File, maxDimension = 1024, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const w = Math.round(width * scale)
      const h = Math.round(height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }))
        },
        "image/jpeg",
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ─── CATEGORY MAPPING ───────────────────────────────────────────────────────────

// Maps backend category names to frontend category keys
// Used for translating between API response and UI state
const CATEGORY_MAP: Record<string, string> = {
  "Appetizer": "appetizer",
  "Main Dish": "main",
  "Dessert": "dessert",
  "Drinks": "drink",
}

// Type definition for API results cache
// Stores categorized food items to avoid re-analysis
type ApiResultsCache = Record<string, FoodItem[]>

type PredictFoodItem = {
  f: string
  sugar: number
  salt: number
  fat: number
  risk: string
  tip: { en: string; ms: string; zh: string } | string
  best_reason?: { en: string; ms: string; zh: string } | string
}

type PredictResults = Record<string, { ranking?: PredictFoodItem[] }> & {
  uniqueFoodCount?: number
}

const SCAN_CONTEXT_KEY = "sihat_scan_results"
const ANALYSIS_SESSION_KEY = "sihat_analysis_session"
const SCAN_CONTEXT_EVENT = "sihat_scan_results_changed"

function notifyScanContextChanged() {
  window.dispatchEvent(new CustomEvent(SCAN_CONTEXT_EVENT, { detail: { source: "recommendation" } }))
}

type AnalysisSessionCategory = "main" | "appetizer" | "dessert" | "drink"

type AnalysisSession = {
  result: PredictResults
  imagePreviews?: string[]
  userText?: string
  selectedCategory?: AnalysisSessionCategory | null
  createdAt?: number
  source?: "chatbot" | "recommendation"
}

function getFirstAnalysisCategory(cache: ApiResultsCache): AnalysisSessionCategory | null {
  return (["main", "appetizer", "dessert", "drink"] as const).find((category) => cache[category]?.length) ?? null
}

function saveScanContext(data: PredictResults, session?: Omit<AnalysisSession, "result" | "createdAt" | "source">) {
  sessionStorage.setItem(SCAN_CONTEXT_KEY, JSON.stringify(data))
  sessionStorage.setItem(ANALYSIS_SESSION_KEY, JSON.stringify({
    result: data,
    imagePreviews: session?.imagePreviews ?? [],
    userText: session?.userText ?? "",
    selectedCategory: session?.selectedCategory ?? null,
    createdAt: Date.now(),
    source: "recommendation",
  } satisfies AnalysisSession))
  notifyScanContextChanged()
}

function clearScanContext() {
  sessionStorage.removeItem(SCAN_CONTEXT_KEY)
  sessionStorage.removeItem(ANALYSIS_SESSION_KEY)
  notifyScanContextChanged()
}

function buildApiResultsCache(data: PredictResults): ApiResultsCache {
  const cache: ApiResultsCache = {}
  for (const [geminiKey, pageKey] of Object.entries(CATEGORY_MAP)) {
    const raw = data[geminiKey]?.ranking ?? []
    cache[pageKey] = raw.map((item, index) => {
      // Tip: backend now returns a trilingual object; gracefully handle legacy string
      const tipObj: { en: string; ms: string; zh: string } =
        item.tip && typeof item.tip === "object"
          ? item.tip
          : { en: String(item.tip ?? ""), ms: String(item.tip ?? ""), zh: String(item.tip ?? "") }

      // best_reason: trilingual object for the top item
      let bestReasonObj: { en: string; ms: string; zh: string } | undefined
      if (index === 0 && item.best_reason) {
        bestReasonObj =
          typeof item.best_reason === "object"
            ? item.best_reason
            : { en: String(item.best_reason), ms: String(item.best_reason), zh: String(item.best_reason) }
      }

      return {
        name: item.f,
        risk: item.risk?.toLowerCase() ?? "medium",
        sugar: `${item.sugar}g`,
        salt: `${item.salt}mg`,
        fat: `${item.fat}g`,
        tip: tipObj,
        ...(bestReasonObj ? { best_reason: bestReasonObj } : {}),
      }
    })
  }
  return cache
}

function normalizeFoodName(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
}

function findMealPlanFood(foodName: string, foods: MealPlanFoodItem[]): MealPlanFoodItem | null {
  const target = normalizeFoodName(foodName)
  if (!target) return null

  return (
    foods.find((food) =>
      (["en", "ms", "zh"] as const).some((lang) => normalizeFoodName(food.name[lang] || "") === target)
    ) ?? null
  )
}

 
// ─── MAIN RECOMMENDATION PAGE COMPONENT ───────────────────────────────────────────────
 
/**
 * Main component for food recommendation and analysis interface
 * Handles image uploads, text input, AI analysis, and results display
 * Supports multi-language interface and mobile-responsive design
 */
export default function RecommendationClient({ initialFoods }: { initialFoods: MealPlanFoodItem[] }) {
  // ─── STATE MANAGEMENT ────────────────────────────────────────────────────────
  
  // Image and file management
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  
  // UI state and loading indicators
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [scanStep, setScanStep] = useState(0)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const [ocrItemCount, setOcrItemCount] = useState<number>(0)
  const [textItemCount, setTextItemCount] = useState<number>(0)
  
  // Results and error handling
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [apiResultsCache, setApiResultsCache] = useState<ApiResultsCache | null>(null)
  const [previousOcr, setPreviousOcr] = useState<string>("")
  
  // User input and navigation
  const [textInput, setTextInput] = useState("")
  const [showCategories, setShowCategories] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [results, setResults] = useState<FoodItem[] | null>(null)
  
  // Modal and mobile UI state
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImage, setModalImage] = useState<string | null>(null)

  // ─── REFS AND CONSTANTS ────────────────────────────────────────────────────────
  
  // Mobile action sheet state for touch devices
  const [isMobile, setIsMobile] = useState(false)
  const [showUploadSheet, setShowUploadSheet] = useState(false)

  // File input refs for different upload methods
  const fileRef = useRef<HTMLInputElement>(null)       // gallery / desktop file picker
  const cameraRef = useRef<HTMLInputElement>(null)     // camera-only (mobile)
  const categoryTabsRef = useRef<HTMLDivElement>(null) // category tabs section (for scroll-back)
  const currentLangRef = useRef<LangCode>("en")        // latest lang from PageLayout render prop
  const [pendingAutoAnalyze, setPendingAutoAnalyze] = useState(false)
  // Scroll flags — set before triggering restore/analyze so result section scrolls into view.
  const scrollAfterRestoreRef = useRef(false)
  const scrollAfterAnalyzeRef = useRef(false)

  const MAX_IMAGES = 5 // Maximum number of images allowed

  // ─── EFFECTS AND HOOKS ───────────────────────────────────────────────────────────
  
  /**
   * Detect mobile device on component mount
   * Uses touch capability detection for mobile identification
   */
  useEffect(() => {
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0)
  }, [])

  /**
   * Restore text input from sessionStorage on mount
   * Preserves user input across page refreshes
   */
  useEffect(() => {
    const savedText = sessionStorage.getItem("rec-text")
    if (savedText) setTextInput(savedText)
  }, [])

  /**
   * Restore the latest analysis saved by the chatbot quick scan.
   * Uses the same API result shape as handleAnalyze; no re-analysis is performed.
   */
  const searchParams = useSearchParams()

  const restoreSharedScanResults = useCallback(() => {
    try {
      const sessionRaw = sessionStorage.getItem(ANALYSIS_SESSION_KEY)
      const storedSession = sessionRaw ? (JSON.parse(sessionRaw) as AnalysisSession) : null
      const raw = sessionStorage.getItem(SCAN_CONTEXT_KEY)
      console.log("[Recommendation] restoreSharedScanResults:", {
        hasScanResult: !!raw,
        hasAnalysisSession: !!sessionRaw,
        source: storedSession?.source ?? null,
      })
      if (!raw) {
        setApiResultsCache(null)
        setShowCategories(false)
        setSelectedCategory(null)
        setResults(null)
        return
      }

      const data = storedSession?.result ?? JSON.parse(raw) as PredictResults
      const cache = buildApiResultsCache(data)
      const selectedSessionCategory = storedSession?.selectedCategory
      const firstCategory = selectedSessionCategory && cache[selectedSessionCategory]?.length
        ? selectedSessionCategory
        : getFirstAnalysisCategory(cache)
      if (!firstCategory) return

      setUploadedImages(storedSession?.imagePreviews ?? [])
      setUploadedFiles([])
      setNewFiles([])
      setPreviousOcr("")
      setTextInput(storedSession?.userText ?? "")
      setAnalyzeError(null)
      setIsAnalyzing(false)
      setSuccessCount(null)
      setApiResultsCache(cache)
      setShowCategories(true)
      setSelectedCategory(firstCategory)
      setResults(cache[firstCategory])
      if (scrollAfterRestoreRef.current) {
        scrollAfterRestoreRef.current = false
        setTimeout(() => {
          document.getElementById("analysis-result-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 150)
      }
    } catch {
      // Ignore malformed session data and let users analyse again normally.
    }
  }, [])

  useEffect(() => {
    restoreSharedScanResults()
    const handleSharedScanUpdate = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.source === "recommendation") return
      restoreSharedScanResults()
    }
    window.addEventListener(SCAN_CONTEXT_EVENT, handleSharedScanUpdate)
    return () => window.removeEventListener(SCAN_CONTEXT_EVENT, handleSharedScanUpdate)
  }, [restoreSharedScanResults])

  // Chatbot fires "sihat_view_analysis" when user is already on this page and
  // clicks "View Detailed Analysis". Instead of navigating, we sync state and scroll.
  useEffect(() => {
    const handleViewAnalysis = () => {
      const hasScanCtx = !!sessionStorage.getItem(SCAN_CONTEXT_KEY)
      const recText = sessionStorage.getItem("rec-text")

      if (hasScanCtx) {
        scrollAfterRestoreRef.current = true
        restoreSharedScanResults()
      } else if (recText) {
        setTextInput(recText)
        setApiResultsCache(null)
        setShowCategories(false)
        setSelectedCategory(null)
        setResults(null)
        scrollAfterAnalyzeRef.current = true
        setPendingAutoAnalyze(true)
      } else {
        // No new analysis — just scroll to whatever is already showing
        setTimeout(() => {
          document.getElementById("analysis-result-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 50)
      }
    }
    window.addEventListener("sihat_view_analysis", handleViewAnalysis)
    return () => window.removeEventListener("sihat_view_analysis", handleViewAnalysis)
  }, [restoreSharedScanResults])

  // When chatbot navigates here with ?fromChatbot=1&ts=..., force a re-read of
  // sessionStorage even if Next.js restored this page from its router cache
  // (in which case the mount-only effect above does not re-run).
  //
  // Two cases:
  //   1. Photo analysis in chatbot → scan context is in sessionStorage → restore results immediately.
  //   2. Text-only chat (no photo scan) → no scan context → set text input and auto-trigger analysis.
  useEffect(() => {
    if (!searchParams.get("fromChatbot")) return

    const hasScanContext = !!sessionStorage.getItem(SCAN_CONTEXT_KEY)

    if (hasScanContext) {
      console.log("[Recommendation] fromChatbot: scan context found, restoring full analysis")
      scrollAfterRestoreRef.current = true
      restoreSharedScanResults()
      return
    }

    // No photo scan — load the food name pre-filled by the chatbot and auto-analyse it
    const savedText = sessionStorage.getItem("rec-text")
    console.log("[Recommendation] fromChatbot: no scan context, auto-analysing:", savedText)
    if (savedText) {
      setTextInput(savedText)
      setApiResultsCache(null)
      setShowCategories(false)
      setSelectedCategory(null)
      setResults(null)
      scrollAfterAnalyzeRef.current = true
      setPendingAutoAnalyze(true)
    }
  }, [searchParams, restoreSharedScanResults])

  // Fires after state from the fromChatbot effect has been committed.
  // currentLangRef.current is kept up-to-date by the PageLayout render prop below.
  useEffect(() => {
    if (!pendingAutoAnalyze || isAnalyzing || !textInput.trim()) return
    setPendingAutoAnalyze(false)
    console.log("[Recommendation] auto-analysing with text:", textInput, "lang:", currentLangRef.current)
    handleAnalyze(currentLangRef.current)
  // handleAnalyze is recreated each render; adding it would re-trigger endlessly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoAnalyze, isAnalyzing, textInput])

  /**
   * Save text input to sessionStorage on changes
   * Ensures data persistence across page refreshes
   */
  useEffect(() => {
    sessionStorage.setItem("rec-text", textInput)
  }, [textInput])

  /**
   * Manage scanning animation during analysis
   * Cycles through scanning steps for visual feedback
   */
  useEffect(() => {
    if (!isAnalyzing) { setScanStep(0); return }
    const id = setInterval(() => setScanStep(prev => (prev + 1) % 4), 1800)
    return () => clearInterval(id)
  }, [isAnalyzing])

  // Close sheet on back-gesture / escape
  useEffect(() => {
    if (!showUploadSheet) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowUploadSheet(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showUploadSheet])

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const remainingSlots = MAX_IMAGES - uploadedImages.length
    if (remainingSlots <= 0) return
    setIsUploading(true)
    const filesToProcess = Array.from(files).slice(0, remainingSlots)
    Promise.all(filesToProcess.map((f) => compressImage(f))).then((compressed) => {
      const newUrls = compressed.map(file => URL.createObjectURL(file))
      setUploadedImages(prev => [...prev, ...newUrls])
      setUploadedFiles(prev => [...prev, ...compressed])
      setIsUploading(false)
      setNewFiles([])
      setPreviousOcr("")
      setApiResultsCache(null)
      setShowCategories(false)
      setSelectedCategory(null)
      setResults(null)
      setAnalyzeError(null)
    })
  }, [uploadedImages.length])

  // ── Button click handler: desktop → file picker, mobile → action sheet ────
  const handleAddPhotoClick = () => {
    if (uploadedImages.length >= MAX_IMAGES) return
    if (isMobile) {
      setShowUploadSheet(true)
    } else {
      fileRef.current?.click()
    }
  }

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
    setNewFiles([])
    setPreviousOcr("")
    setShowCategories(false)
    setSelectedCategory(null)
    setResults(null)
    setApiResultsCache(null)
  }

  const removeAllImages = () => {
    setUploadedImages([])
    setUploadedFiles([])
    setNewFiles([])
    setPreviousOcr("")
    setShowCategories(false)
    setSelectedCategory(null)
    setResults(null)
    setApiResultsCache(null)
    clearScanContext()
  }

  const handleAnalyze = async (lang: string) => {
    setAnalyzeError(null)
    setIsAnalyzing(true)
    setSuccessCount(null)
    setShowCategories(false)
    setSelectedCategory(null)
    setResults(null)

    // Calculate text item count (split by comma)
    const textItems = textInput.trim() ? textInput.split(',').map(item => item.trim()).filter(item => item.length > 0) : []
    setTextItemCount(textItems.length)
    setOcrItemCount(uploadedFiles.length) // Placeholder, will be updated with actual OCR count

    let succeeded = false
    try {
      const formData = new FormData()
      if (textInput.trim()) formData.append("userText", textInput.trim())
      uploadedFiles.forEach(file => formData.append("file", file))

      // Get current language from PageLayout context and send to backend
      formData.append("language", lang)

      const res = await fetch("/api/predict", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || `Server error ${res.status}`)
      }

      const data = await res.json()

      const cache = buildApiResultsCache(data as PredictResults)
      const firstCategory = getFirstAnalysisCategory(cache)

      // ─── Epic 9: Save scan results for AI Chatbot context ───
      // AIChatbot reads this to give context-aware food advice
      // Auto-cleared when browser tab closes (privacy by design)
      saveScanContext(data as PredictResults, {
        imagePreviews: uploadedImages,
        userText: textInput.trim(),
        selectedCategory: firstCategory,
      })
      // ─────────────────────────────────────────────────────────

      setApiResultsCache(cache)
      succeeded = true

      //const totalFound = Object.values(cache).flat().length
      const totalFound = data.uniqueFoodCount ?? Object.values(cache).flat().length
      setIsAnalyzing(false)
      setSuccessCount(totalFound)
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSuccessCount(null)
      setShowCategories(true)
      if (firstCategory) {
        setSelectedCategory(firstCategory)
        setResults(cache[firstCategory])
      }
      if (scrollAfterAnalyzeRef.current) {
        scrollAfterAnalyzeRef.current = false
        setTimeout(() => {
          document.getElementById("analysis-result-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 150)
      }
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      if (!succeeded) setIsAnalyzing(false)
    }
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
    setShowCategories(true)
    const categoryResults = apiResultsCache?.[category] ?? []
    setResults(categoryResults)
  }

  const handleAnalyzeAnother = () => {
    setShowCategories(true)
    setSelectedCategory(null)
    setResults(null)
  }

  const clearAll = () => {
    setUploadedImages([])
    setUploadedFiles([])
    setNewFiles([])
    setPreviousOcr("")
    setTextInput("")
    setShowCategories(false)
    setSelectedCategory(null)
    setResults(null)
    setApiResultsCache(null)
    setAnalyzeError(null)
    clearScanContext()
  }

  const openImageModal = (imageUrl: string) => {
    setModalImage(imageUrl)
    setShowImageModal(true)
  }

  const hasContent = uploadedImages.length > 0 || textInput.trim().length > 0
  const showAnalyzeButton = hasContent && !isAnalyzing && !results && !showCategories && successCount === null
  const showCategoryTabs = showCategories || !!results

  return (
    <PageLayout>
      {(lang) => {
        currentLangRef.current = lang
        const t = content[lang]
        return (
          <div className="max-w-7xl mx-auto px-4 py-10 md:py-14 space-y-10">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-2xl md:text-5xl font-extrabold mb-4 text-balance">{t.page_title}</h1>
              <p className="text-lg md:text-xl text-muted-foreground">{t.page_subtitle}</p>
            </div>

            {/* Upload & Text Input Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {/* Left: Upload Area */}
              <div className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-sm">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <Upload className="w-6 h-6 text-primary" />
                  {t.upload_title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={`text-lg font-bold ${uploadedImages.length >= MAX_IMAGES ? "text-amber-600" : "text-muted-foreground"}`}>
                    {t.max_photos} ({uploadedImages.length}/{MAX_IMAGES})
                  </span>
                  {uploadedImages.length >= MAX_IMAGES && (
                    <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-base font-semibold px-3 py-1.5 rounded-full">
                      <Info className="w-5 h-5" />
                      {t.max_photos_warning}
                    </span>
                  )}
                </div>

                {isUploading ? (
                  <div className="border-2 border-dashed border-primary/40 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[250px]">
                    <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                    <p className="text-lg font-semibold text-primary">{t.uploading}</p>
                  </div>
                ) : uploadedImages.length > 0 ? (
                  <div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {uploadedImages.map((img, index) => (
                        <div key={index} className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary group">
                          <Image src={img} alt={`Uploaded ${index + 1}`} fill className="object-cover cursor-pointer" onClick={() => openImageModal(img)} />
                          <button
                            onClick={(e) => { e.stopPropagation(); removeImage(index) }}
                            className="absolute top-1 right-1 z-20 bg-foreground text-background rounded-full w-7 h-7 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-md"
                            aria-label="Remove image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute inset-0 z-10 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center pointer-events-none">
                            <ZoomIn className="w-6 h-6 text-background opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}
                      {uploadedImages.length < MAX_IMAGES && (
                        <button
                          onClick={handleAddPhotoClick}
                          className="aspect-square rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <Plus className="w-8 h-8 text-primary mb-1" />
                          <span className="text-xs text-muted-foreground">Add</span>
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleAddPhotoClick}
                      disabled={uploadedImages.length >= MAX_IMAGES}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-lg py-4 px-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Camera className="w-6 h-6 shrink-0" />
                      <span>{t.upload_btn}</span>
                    </button>
                    {uploadedImages.length > 1 && (
                      <button
                        onClick={removeAllImages}
                        className="mt-3 w-full flex items-center justify-center gap-2 border border-destructive text-destructive font-semibold py-3 rounded-xl hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                        {t.delete_all}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      className="border-2 border-dashed border-primary/40 rounded-2xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer min-h-[200px] flex flex-col items-center justify-center"
                      onClick={handleAddPhotoClick}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files) }}
                    >
                      <Upload className="w-16 h-16 text-primary mx-auto mb-4" />
                      <p className="text-lg font-semibold text-foreground mb-2">{t.upload_hint}</p>
                      <p className="text-sm text-muted-foreground">JPG, PNG ({t.max_photos})</p>
                    </div>
                    <button
                      onClick={handleAddPhotoClick}
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-lg py-4 px-4 rounded-2xl hover:opacity-90"
                    >
                      <Camera className="w-6 h-6 shrink-0" />
                      <span>{t.upload_btn}</span>
                    </button>
                  </>
                )}

                {/* Hidden inputs — always in DOM so refs are stable */}
                {/* Gallery / desktop picker: no capture attribute → opens file explorer on desktop, photo library on mobile */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  suppressHydrationWarning
                  className="hidden"
                  onChange={(e) => { handleFileUpload(e.target.files); e.target.value = "" }}
                />
                {/* Camera-only input: capture="environment" → opens rear camera directly on mobile */}
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  suppressHydrationWarning
                  className="hidden"
                  onChange={(e) => { handleFileUpload(e.target.files); e.target.value = "" }}
                />
              </div>

              {/* Right: Text Input */}
              <div className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-sm">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <Utensils className="w-6 h-6 text-primary" />
                  {t.text_input_title}
                </h3>
                <p className="text-muted-foreground mb-4">{t.text_input_hint}</p>
                <textarea
                  value={textInput}
                  suppressHydrationWarning
                  onChange={(e) => {
                    setTextInput(e.target.value)
                    if (showCategories || results || apiResultsCache) {
                      setShowCategories(false)
                      setSelectedCategory(null)
                      setResults(null)
                      setApiResultsCache(null)
                      setPreviousOcr("")
                      setNewFiles([])
                    }
                  }}
                  placeholder={t.text_placeholder}
                  className="w-full h-[200px] md:h-[250px] p-4 rounded-xl border border-border bg-background text-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </div>

            {/* Photo Guide */}
            <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4 md:p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary">
                <Camera className="w-7 h-7" />
                {t.guide_title}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {t.guide_steps.map((step, i) => (
                  <div key={i} className="bg-card rounded-xl p-4 text-center border border-border">
                    <div className="w-12 h-12 mx-auto mb-3 bg-primary/10 rounded-full flex items-center justify-center">
                      {i === 0 && <Camera className="w-6 h-6 text-primary" />}
                      {i === 1 && <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                      {i === 2 && <Utensils className="w-6 h-6 text-primary" />}
                      {i === 3 && <CheckCircle className="w-6 h-6 text-primary" />}
                    </div>
                    <p className="text-base font-medium">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Analyse Button */}
            {showAnalyzeButton && (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={() => handleAnalyze(lang)}
                  disabled={isAnalyzing}
                  className="flex items-center justify-center gap-3 bg-accent text-accent-foreground font-bold text-xl px-12 py-5 rounded-2xl hover:opacity-90 transition-opacity shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-7 h-7" />
                  {t.analyze_btn}
                </button>
              </div>
            )}

            {/* Loading */}
            {isAnalyzing && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80" fill="none">
                    <circle cx="40" cy="40" r="34" stroke="var(--color-primary)" strokeOpacity="0.15" strokeWidth="8" />
                    <circle cx="40" cy="40" r="34" stroke="var(--color-primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray="53 160" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-primary">{t.scanning_steps[scanStep]}</p>
                <div className="text-center text-sm text-muted-foreground">
                  <span>OCR: {ocrItemCount} items</span>
                  {textItemCount > 0 && (
                    <>
                      <span className="mx-2">•</span>
                      <span>Text: {textItemCount} items</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {analyzeError && !isAnalyzing && (
              <div className="bg-[var(--risk-high-bg)] border border-red-700/30 rounded-xl px-6 py-4 text-red-700 font-semibold text-base text-center max-w-lg mx-auto">
                <Info className="inline w-5 h-5 mr-2 mb-0.5" />
                {analyzeError}
              </div>
            )}

            {/* Success */}
            {successCount !== null && (
              <div className="flex flex-col items-center gap-3 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-20 h-20 rounded-full bg-[var(--risk-low-bg)] flex items-center justify-center shadow-md">
                  <CheckCircle className="w-10 h-10 text-[var(--risk-low)]" />
                </div>
                <p className="text-2xl font-extrabold text-[var(--risk-low)]">
                  {successCount > 0 ? `${successCount} ${t.success_found}` : t.success_none}
                </p>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Analysis Result Section (scroll target for chatbot deep-link) ── */}
            <div id="analysis-result-section">

            {/* Category Selection */}
            {showCategoryTabs && (
              <div ref={categoryTabsRef} className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-sm">
                <h2 className="text-2xl font-bold mb-2 text-center">{t.select_category}</h2>
                <p className="text-muted-foreground text-center mb-6">{t.select_category_hint}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                  <button
                    onClick={() => handleCategorySelect("appetizer")}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                      selectedCategory === "appetizer"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    <Salad className="w-5 h-5 text-primary" />
                    <span className="text-base font-bold">{t.categories.appetizer}</span>
                  </button>
                  <button
                    onClick={() => handleCategorySelect("main")}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                      selectedCategory === "main"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    <Utensils className="w-5 h-5 text-primary" />
                    <span className="text-base font-bold">{t.categories.main}</span>
                  </button>
                  <button
                    onClick={() => handleCategorySelect("dessert")}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                      selectedCategory === "dessert"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    <Cake className="w-5 h-5 text-primary" />
                    <span className="text-base font-bold">{t.categories.dessert}</span>
                  </button>
                  <button
                    onClick={() => handleCategorySelect("drink")}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                      selectedCategory === "drink"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    <GlassWater className="w-5 h-5 text-primary" />
                    <span className="text-base font-bold">{t.categories.drink}</span>
                  </button>
                </div>
              </div>
            )}

            {/* No Results */}
            {results && results.length === 0 && (
              <div className="bg-[var(--cb-pink)] border border-[#8b3a62]/30 rounded-2xl p-4 md:p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#8b3a62]/10 rounded-full flex items-center justify-center">
                  <Info className="w-8 h-8 text-[#8b3a62]" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-[#8b3a62]">{t.no_results}</h3>
                <p className="text-base text-foreground/80 mb-6">{t.no_results_hint}</p>
                <button onClick={clearAll} className="w-full flex items-center justify-center gap-2 bg-[#8b3a62] text-white font-bold text-lg py-4 rounded-2xl hover:opacity-90">
                  <Trash2 className="w-5 h-5" />
                  {t.analyze_new_food}
                </button>
              </div>
            )}

            {/* Results */}
            {results && results.length > 0 && (
              <div>
                <h2 className="text-3xl font-bold mb-3">{t.result_title} - {t.categories[selectedCategory as keyof typeof t.categories]}</h2>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {[
                    { bg: "bg-[var(--risk-low-bg)]", text: "text-[var(--risk-low)]", label: t.risk_low, icon: TrendingDown, isHigh: false },
                    { bg: "bg-[var(--risk-medium-bg)]", text: "text-[var(--risk-medium)]", label: t.risk_medium, icon: Minus, isHigh: false },
                    { bg: "bg-[#FFF3CD]", text: "text-[#856404]", label: t.risk_high, icon: TrendingUp, isHigh: true },
                  ].map((l) => (
                    <span key={l.label} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-base ${l.isHigh ? "font-extrabold" : "font-semibold"} ${l.bg} ${l.text}`}>
                      <l.icon className="w-5 h-5" />
                      {l.label}
                    </span>
                  ))}
                </div>
                <div className="bg-slate-100 rounded-xl px-5 py-4 mb-4 flex items-start gap-3 border border-slate-200">
                  <Info className="w-5 h-5 shrink-0 mt-0.5 text-slate-600" />
                  <p className="text-lg font-semibold text-[var(--risk-low)] leading-relaxed">{t.disclaimer}</p>
                </div>
                <div className="bg-[var(--risk-low-bg)] border border-[var(--risk-low)]/30 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
                  <Star className="w-6 h-6 text-[var(--risk-low)] shrink-0 mt-0.5" />
                  <p className="text-lg font-semibold text-[var(--risk-low)] leading-relaxed">{t.top3_disclaimer}</p>
                </div>
                <div className="space-y-4">
                  {results.map((food, i) => (
                    <FoodResultCard
                      key={i}
                      food={food}
                      isBest={i === 0}
                      t={t}
                      lang={lang}
                      mealPlanFood={findMealPlanFood(food.name, initialFoods)}
                    />
                  ))}
                </div>
                <div className="mt-8 flex gap-3">
                  {/* Back button — scrolls to category tabs */}
                  <button
                    onClick={() => {
                      handleAnalyzeAnother()
                      setTimeout(() => {
                        categoryTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }, 50)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#ADD8E6] text-[#1a5276] font-bold text-lg py-4 rounded-2xl hover:bg-[#93c6d6] transition-colors border-2 border-[#ADD8E6]"
                  >
                    <ArrowRight className="w-5 h-5 rotate-180" />
                    {t.back_to_category}
                  </button>
                  {/* Reset button — half width, right side */}
                  <button
                    onClick={clearAll}
                    className="flex-none w-[calc(50%-6px)] flex items-center justify-center gap-2 border-2 border-border text-foreground font-bold text-lg py-4 rounded-2xl hover:bg-muted"
                  >
                    <Trash2 className="w-5 h-5" />
                    {t.analyze_new_food}
                  </button>
                </div>
              </div>
            )}

            </div>{/* end analysis-result-section */}

            {/* Image Modal */}
            {showImageModal && modalImage && (
              <div className="fixed inset-0 bg-foreground/80 z-50 flex items-center justify-center p-4" onClick={() => setShowImageModal(false)}>
                <div className="relative max-w-4xl w-full max-h-[90vh]">
                  <button onClick={() => setShowImageModal(false)} className="absolute -top-12 right-0 text-background hover:text-muted p-2">
                    <X className="w-8 h-8" />
                  </button>
                  <div className="relative w-full h-[80vh] rounded-2xl overflow-hidden">
                    <Image src={modalImage} alt="Full size meal" fill className="object-contain bg-background" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Mobile Upload Action Sheet ─────────────────────────────────────────── */}
            {showUploadSheet && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 bg-black/50 z-50 transition-opacity"
                  onClick={() => setShowUploadSheet(false)}
                />
                {/* Sheet */}
                <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
                  <div className="bg-card rounded-t-3xl shadow-2xl overflow-hidden mx-0 pb-safe">
                    {/* Handle bar */}
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                    </div>

                    {/* Title */}
                    <p className="text-center text-base font-semibold text-muted-foreground px-6 pb-3 pt-1">
                      {t.sheet_title}
                    </p>

                    <div className="px-4 pb-3 space-y-2">
                      {/* Take Photo */}
                      <button
                        onClick={() => {
                          setShowUploadSheet(false)
                          // Small delay so sheet finishes animating out before camera opens
                          setTimeout(() => cameraRef.current?.click(), 150)
                        }}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-primary/5 hover:bg-primary/10 active:bg-primary/15 transition-colors text-left"
                      >
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Camera className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-lg font-semibold text-foreground">{t.sheet_camera}</span>
                      </button>

                      {/* Choose from Gallery */}
                      <button
                        onClick={() => {
                          setShowUploadSheet(false)
                          setTimeout(() => fileRef.current?.click(), 150)
                        }}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-primary/5 hover:bg-primary/10 active:bg-primary/15 transition-colors text-left"
                      >
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-lg font-semibold text-foreground">{t.sheet_gallery}</span>
                      </button>
                    </div>

                    {/* Cancel — visually separated */}
                    <div className="px-4 pb-6 pt-1">
                      <button
                        onClick={() => setShowUploadSheet(false)}
                        className="w-full py-4 rounded-2xl bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors text-lg font-bold text-foreground"
                      >
                        {t.sheet_cancel}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      }}
    </PageLayout>
  )
}
