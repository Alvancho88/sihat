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
import { DailyIntakePanel, type DailyIntakePanelStrings } from "@/components/ui/daily-intake-panel"

import Image from "next/image"
import {
  Camera, Upload, X, Star, TrendingDown, TrendingUp, Minus,
  CheckCircle, Info, Loader2, ZoomIn, Utensils, GlassWater, Cake, Salad, Plus, Trash2, ArrowRight, ArrowLeft, ImageIcon, ShoppingCart, Type, ChevronLeft, ChevronRight, Sun, Smartphone
} from "lucide-react"

// Define language codes for multi-language support
type LangCode = "en" | "ms" | "zh"

// ─── MULTI-LANGUAGE CONTENT ───────────────────────────────────────────────────────
 
// Comprehensive content object supporting English, Malay, and Chinese
// Contains all UI text, labels, and messages for internationalization
const content = {
  en: {
    page_title: "Check Your Food",
    page_subtitle: "Snap a photo of your food to get health recommendations",
    guide_title: "How to Take a Good Photo",
    guide_steps: [
      { icon: "camera", text: "Hold your phone steady above the menu" },
      { icon: "light", text: "Make sure there is good lighting" },
      { icon: "food", text: "If there is too much menu items in one photo, take it separately" },
      { icon: "clear", text: "Ensure the text is clearly visible" },
    ],
    upload_title: "Take or Upload a Photo",
    upload_hint: "Tap to take a photo or upload from gallery",
    upload_format: "JPG, PNG (Maximum 5 Photos)",
    upload_btn: "Add Photo",
    camera_btn: "Take Photo",
    uploading: "Uploading...",
    click_to_view: "Click to view full image",
    text_input_title: "Type Your Food Name",
    text_input_hint: "No photo? Type the dish name here instead. Separate each item with comma.",
    text_placeholder: "E.g., Nasi lemak, Roti canai, Teh tarik...",
    type_food_instead: "Or type food name instead",
    back_to_photo: "Back to photo upload",
    analyze_btn: "Analyse My Food",
    select_category: "Select Food Category",
    select_category_hint: "Choose which type of food you want to view:",
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
    analyze_new_food: "Start Over",
    back_to_category: "Back to Categories",
    best_choice_reason_label: "Why we pick this as the Best Choice",
    add_to_meal_plan: "Add to Meal Plan",
    in_meal_plan: "In Meal Plan",
    added_to_meal_plan: "Added to your meal plan",
    removed_from_meal_plan: "Removed from your meal plan",
    meal_plan_unavailable: "AI-generated food analysis",
    meal_plan_unavailable_hint: "This food is not currently in the SIHAT food database. The nutrition information and health advice shown here are estimated by AI and may not be fully accurate.",
    // Action sheet
    sheet_title: "Add Photo",
    sheet_camera: "Take Photo",
    sheet_gallery: "Choose from Gallery",
    sheet_cancel: "Cancel",
    view_cart: "View Plan",
    // Panel navigation
    panel_upload: "Upload Photo",
    panel_results: "View Results",
    try_another_photo: "Add More Photo",
    view_your_results: "View Your Results",
  },
  ms: {
    page_title: "Semak Makanan Anda",
    page_subtitle: "Ambil foto makanan anda untuk dapatkan cadangan kesihatan",
    guide_title: "Cara Mengambil Foto yang Baik",
    guide_steps: [
      { icon: "camera", text: "Pegang telefon anda dengan stabil di atas makanan" },
      { icon: "light", text: "Pastikan pencahayaan yang baik" },
      { icon: "split", text: "Masukkan semua hidangan dalam satu foto" },
      { icon: "clear", text: "Pastikan makanan jelas kelihatan" },
    ],
    upload_title: "Ambil atau Muat Naik Foto",
    upload_hint: "Ketik untuk ambil foto atau muat naik dari galeri",
    upload_format: "JPG, PNG (Maksimum 5 Foto)",
    upload_btn: "Tambah Foto",
    camera_btn: "Ambil Foto",
    uploading: "Memuat naik...",
    click_to_view: "Klik untuk lihat imej penuh",
    text_input_title: "Taip Nama Makanan Anda",
    text_input_hint: "Tiada foto? Taip nama hidangan di sini. Pisahkan setiap item dengan koma.",
    text_placeholder: "Cth., Nasi lemak, Roti canai, Teh tarik...",
    type_food_instead: "Atau taip nama makanan",
    back_to_photo: "Kembali ke muat naik foto",
    analyze_btn: "Analisis Makanan Saya",
    select_category: "Pilih Kategori Makanan",
    select_category_hint: "Pilih jenis makanan yang ingin anda lihat:",
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
    analyze_new_food: "Mula Semula",
    back_to_category: "Kembali ke Kategori",
    best_choice_reason_label: "Kenapa Pilihan Terbaik",
    add_to_meal_plan: "Tambah ke Pelan Makanan",
    in_meal_plan: "Dalam Pelan Makanan",
    added_to_meal_plan: "Ditambah ke pelan makanan anda",
    removed_from_meal_plan: "Dikeluarkan daripada pelan makanan anda",
    meal_plan_unavailable: "Analisis makanan jana AI",
    meal_plan_unavailable_hint: "Makanan ini tidak terdapat dalam pangkalan data makanan SIHAT. Maklumat pemakanan dan nasihat kesihatan yang ditunjukkan di sini dianggarkan oleh AI dan mungkin tidak sepenuhnya tepat.",
    sheet_title: "Tambah Foto",
    sheet_camera: "Ambil Foto",
    sheet_gallery: "Pilih dari Galeri",
    sheet_cancel: "Batal",
    view_cart: "Lihat Pelan",
    panel_upload: "Muat Naik Foto",
    panel_results: "Lihat Keputusan",
    try_another_photo: "Tambah Foto",
    view_your_results: "Lihat Keputusan Anda",
  },
  zh: {
    page_title: "检查您的食物",
    page_subtitle: "拍摄食物照片以获取健康建议",
    guide_title: "如何拍摄好照片",
    guide_steps: [
      { icon: "camera", text: "将手机稳定地放在食物上方" },
      { icon: "light", text: "确保光线充足" },
      { icon: "split", text: "将所有菜肴放在一张照片中" },
      { icon: "clear", text: "确保食物清晰可见" },
    ],
    upload_title: "拍摄或上传照片",
    upload_hint: "点击拍照或从相册上传",
    upload_format: "JPG, PNG（最多5张照片）",
    upload_btn: "添加照片",
    camera_btn: "拍照",
    uploading: "上传中...",
    click_to_view: "点击查看大图",
    text_input_title: "输入食物名称",
    text_input_hint: "没有照片？在这里输入菜名。用逗号分隔每个项目。",
    text_placeholder: "例如：椰浆饭、印度煎饼、拉茶...",
    type_food_instead: "或输入食物名称",
    back_to_photo: "返回上传照片",
    analyze_btn: "分析我的食物",
    select_category: "选择食物类别",
    select_category_hint: "选择您想查看的食物类型：",
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
    top3_disclaimer: "我们为您展示了食物����片��发现的前3个最健康的选择。这些是对您血糖最安全的选项。",
    analyze_new_food: "重新开始",
    back_to_category: "返回类别",
    best_choice_reason_label: "为何是最佳选择",
    add_to_meal_plan: "加入饮食计划",
    in_meal_plan: "已在饮食计划中",
    added_to_meal_plan: "已加入您的饮食计划",
    removed_from_meal_plan: "已从饮食计划中移除",
    meal_plan_unavailable: "AI生成的食物分析",
    meal_plan_unavailable_hint: "此食物目前不在SIHAT食物数据库中。此处显示的营养信息和健康建议由AI估算，可能并不完全准确。",
    sheet_title: "添加照片",
    sheet_camera: "拍照",
    sheet_gallery: "从相册选择",
    sheet_cancel: "取消",
    view_cart: "查看计划",
    panel_upload: "上传照片",
    panel_results: "查看结果",
    try_another_photo: "添加照片",
    view_your_results: "查看您的结果",
  },
}

// Strings passed to the shared DailyIntakePanel component
const dailyIntakePanelContent: Record<LangCode, DailyIntakePanelStrings> = {
  en: {
    daily_intake: "Daily Intake",
    no_items: "No items in your daily plan",
    no_items_hint: "Tap '+' on any food to start planning",
    clear_all: "Clear All",
    total: "Total",
    daily_limit: "Daily Limit",
    nutrition_sugar: "Sugar",
    nutrition_fat: "Fat",
    nutrition_sodium: "Sodium",
    nutrition_gi: "GI",
    nutrition_cal: "Cal",
    male: "Male",
    female: "Female",
    exceeded_by: "Exceeded",
    sugar_status_ok: "Sugar intake is within limit.",
    sugar_status_over: "Sugar intake exceeds daily limit.",
    fat_status_ok: "Fat intake is within limit.",
    fat_status_over: "Fat intake exceeds daily limit.",
    sodium_status_ok: "Sodium intake is within limit.",
    sodium_status_over: "Sodium intake exceeds daily limit.",
    health_tip_short: "Health tip",
    sugar_tip_1: "Reduce sugary drinks and desserts",
    sugar_tip_2: "Choose lower GI foods next meal",
    fat_tip_1: "Choose grilled or steamed foods next meal",
    fat_tip_2: "Reduce fried foods and creamy sauces",
    sodium_tip_1: "Drink more water today",
    sodium_tip_2: "Reduce salty soups, sauces, and processed foods",
  },
  ms: {
    daily_intake: "Pengambilan Harian",
    no_items: "Tiada item dalam pelan harian",
    no_items_hint: "Ketik '+' pada makanan untuk mula merancang",
    clear_all: "Kosongkan",
    total: "Jumlah",
    daily_limit: "Had Harian",
    nutrition_sugar: "Gula",
    nutrition_fat: "Lemak",
    nutrition_sodium: "Natrium",
    nutrition_gi: "GI",
    nutrition_cal: "Kal",
    male: "Lelaki",
    female: "Perempuan",
    exceeded_by: "Melebihi",
    sugar_status_ok: "Pengambilan gula dalam had.",
    sugar_status_over: "Pengambilan gula melebihi had harian.",
    fat_status_ok: "Pengambilan lemak dalam had.",
    fat_status_over: "Pengambilan lemak melebihi had harian.",
    sodium_status_ok: "Pengambilan natrium dalam had.",
    sodium_status_over: "Pengambilan natrium melebihi had harian.",
    health_tip_short: "Tip kesihatan",
    sugar_tip_1: "Kurangkan minuman manis dan pencuci mulut",
    sugar_tip_2: "Pilih makanan GI lebih rendah untuk hidangan seterusnya",
    fat_tip_1: "Pilih makanan panggang atau kukus untuk hidangan seterusnya",
    fat_tip_2: "Kurangkan makanan bergoreng dan sos berkrim",
    sodium_tip_1: "Minum lebih air hari ini",
    sodium_tip_2: "Kurangkan sup masin, sos, dan makanan diproses",
  },
  zh: {
    daily_intake: "每日摄取量",
    no_items: "计划中没有食物",
    no_items_hint: "点击食物上的'+'开始规划",
    clear_all: "清空",
    total: "总计",
    daily_limit: "每日限量",
    nutrition_sugar: "糖分",
    nutrition_fat: "脂肪",
    nutrition_sodium: "钠",
    nutrition_gi: "GI",
    nutrition_cal: "大卡",
    male: "男性",
    female: "女性",
    exceeded_by: "超出",
    sugar_status_ok: "糖分摄取在限量内。",
    sugar_status_over: "糖分摄取超出每日限量。",
    fat_status_ok: "脂肪摄取在限量内。",
    fat_status_over: "脂肪摄取超出每日限量。",
    sodium_status_ok: "钠摄取在限量内。",
    sodium_status_over: "钠摄取超出每日限量。",
    health_tip_short: "健康提示",
    sugar_tip_1: "减少含糖饮料和甜点",
    sugar_tip_2: "下一餐选择较低 GI 的食物",
    fat_tip_1: "下一餐选择烤或蒸的食物",
    fat_tip_2: "减少油炸食物和奶油酱汁",
    sodium_tip_1: "今天多喝水",
    sodium_tip_2: "减少咸汤、酱料和加工食品",
  },
}

// Floating "View Plan" button — must render inside CartProvider (i.e. inside PageLayout)
// so it can read cart.length for the badge via useCart().
function ViewPlanButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { cart } = useCart()
  return (
    <button
      onClick={onClick}
      className="fixed top-[4.25rem] md:top-24 right-4 md:right-8 z-50 inline-flex items-center gap-2 px-5 md:px-6 py-2 md:py-2.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-lg"
    >
      <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
      <span className="text-base md:text-lg">{label}</span>
      {cart.length > 0 && (
        <span className="bg-white text-primary text-sm md:text-base font-bold w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center">
          {cart.length}
        </span>
      )}
    </button>
  )
}

function RiskBadge({ risk, t }: { risk: string; t: typeof content.en }) {
  const configs = {
    low: { label: t.risk_low, icon: TrendingDown, bg: "bg-[var(--risk-low-bg)]", text: "text-[var(--risk-low)]", border: "" },
    medium: { label: t.risk_medium, icon: Minus, bg: "bg-[var(--risk-medium-bg)]", text: "text-[var(--risk-medium)]", border: "" },
    high: { label: t.risk_high, icon: TrendingUp, bg: "bg-[#FFF3CD]", text: "text-[#856404]", border: "" },
  }
  const c = configs[risk as keyof typeof configs] || configs.medium
  const isHigh = risk === "high"
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full ${c.bg} ${c.text} ${c.border} ${isHigh ? "font-extrabold" : ""}`}>
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
  if (level === "high") return "bg-[#FFF3CD] text-[#856404]" 
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
            <span className={`ml-1 ${sugarLevel === "high" ? "font-extrabold" : ""}`}>{food.sugar}</span>
          </div>
          <div className={`rounded-xl px-4 py-2 ${indicatorClass(saltLevel)}`}>
            <span className="font-semibold text-foreground">{t.nutrition_salt}:</span>
            <span className={`ml-1 ${saltLevel === "high" ? "font-extrabold" : ""}`}>{food.salt}</span>
          </div>
          <div className={`rounded-xl px-4 py-2 ${indicatorClass(fatLevel)}`}>
            <span className="font-semibold text-foreground">{t.nutrition_fat}:</span>
            <span className={`ml-1 ${fatLevel === "high" ? "font-extrabold" : ""}`}>{food.fat}</span>
          </div>
        </div>
        <div className={`flex items-start gap-2 rounded-xl p-4 ${
          isHighRisk
            ? "bg-[#FFF3CD]"
            : "bg-accent/20"
        }`}>
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-accent-foreground" />
          <p className="text-base text-foreground">
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
              <p className="mt-2 text-sm text-slate-500">{t.meal_plan_unavailable_hint}</p>
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

function getAvailableCategories(cache: ApiResultsCache | null): AnalysisSessionCategory[] {
  if (!cache) return []
  return (["main", "appetizer", "dessert", "drink"] as const).filter((category) => cache[category]?.length > 0)
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
  const [cartOpen, setCartOpen] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImage, setModalImage] = useState<string | null>(null)

  // Panel navigation state - "upload" or "results"
  const [currentPanel, setCurrentPanel] = useState<"upload" | "results">("upload")
  
  // Text input mode toggle (hidden by default, shown when user clicks the button)
  const [showTextInput, setShowTextInput] = useState(false)

  // ─── REFS AND CONSTANTS ────────────────────────────────────────────────────────
  
  // Mobile action sheet state for touch devices
  const [isMobile, setIsMobile] = useState(false)
  const [showUploadSheet, setShowUploadSheet] = useState(false)

  // File input refs for different upload methods
  const fileRef = useRef<HTMLInputElement>(null)       // gallery / desktop file picker
  const cameraRef = useRef<HTMLInputElement>(null)     // camera-only (mobile)
  const categoryTabsRef = useRef<HTMLDivElement>(null) // category tabs section (for scroll-back)
  const uploadPanelRef = useRef<HTMLDivElement>(null)  // upload panel container (for scroll to upload)
  const analyzeButtonRef = useRef<HTMLButtonElement>(null) // analyze button (for scroll after photo added)
  const panelNavRef = useRef<HTMLDivElement>(null)     // panel navigation tabs (for scroll to results)
  const currentLangRef = useRef<LangCode>("en")        // latest lang from PageLayout render prop
  const [pendingAutoAnalyze, setPendingAutoAnalyze] = useState(false)

  const MAX_IMAGES = 5 // Maximum number of images allowed

  // Check if we have results to show
  const hasResults = apiResultsCache && Object.values(apiResultsCache).some(arr => arr.length > 0)

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
    if (savedText) {
      setTextInput(savedText)
      setShowTextInput(true)
    }
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
      if (storedSession?.userText) setShowTextInput(true)
      setAnalyzeError(null)
      setIsAnalyzing(false)
      setSuccessCount(null)
      setApiResultsCache(cache)
      setShowCategories(true)
      setSelectedCategory(firstCategory)
      setResults(cache[firstCategory])
      // Auto-navigate to results panel when restoring
      setCurrentPanel("results")
      // Scroll to panel navigation after restore (shows category + results)
      setTimeout(() => {
        panelNavRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 150)
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
        restoreSharedScanResults()
      } else if (recText) {
        setTextInput(recText)
        setShowTextInput(true)
        setApiResultsCache(null)
        setShowCategories(false)
        setSelectedCategory(null)
        setResults(null)
        setPendingAutoAnalyze(true)
      } else {
        // No new analysis — just scroll to whatever is already showing
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: "smooth" })
        }, 50)
      }
    }
    window.addEventListener("sihat_view_analysis", handleViewAnalysis)
    return () => window.removeEventListener("sihat_view_analysis", handleViewAnalysis)
  }, [restoreSharedScanResults])

  // Chatbot fires "sihat-analysis-reset" when the user asks to reset the analysis.
  // Runs the same clearAll() used by the Reset button so the page returns to its
  // initial upload/type state without requiring any UI interaction.
  useEffect(() => {
    const handleAnalysisReset = () => clearAll()
    window.addEventListener("sihat-analysis-reset", handleAnalysisReset)
    return () => window.removeEventListener("sihat-analysis-reset", handleAnalysisReset)
  }, [])

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
      restoreSharedScanResults()
      return
    }

    // No photo scan — load the food name pre-filled by the chatbot and auto-analyse it
    const savedText = sessionStorage.getItem("rec-text")
    console.log("[Recommendation] fromChatbot: no scan context, auto-analysing:", savedText)
    if (savedText) {
      setTextInput(savedText)
      setShowTextInput(true)
      setApiResultsCache(null)
      setShowCategories(false)
      setSelectedCategory(null)
      setResults(null)
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
      // Reset to upload panel when new photos are added
      setCurrentPanel("upload")
      // Scroll to show analyze button after photo is added (hide title/subtitle)
      setTimeout(() => {
        analyzeButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 150)
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
      // Auto-navigate to results panel after successful analysis
      setCurrentPanel("results")
      // Scroll to panel navigation (hides title/subtitle, shows category + results)
      setTimeout(() => {
        panelNavRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 150)
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
    setShowTextInput(false)
    setShowCategories(false)
    setSelectedCategory(null)
    setResults(null)
    setApiResultsCache(null)
    setAnalyzeError(null)
    setCurrentPanel("upload")
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
          <>
          <div className="max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-4 py-4 md:py-6 min-h-[calc(100vh-200px)]">
            {/* Simple Header - follows 5 second rule */}
            <div className="text-center mb-6 pt-10">
              <h1 className="text-2xl md:text-5xl font-extrabold mb-4 text-balance">{t.page_title}</h1>
              <p className="text-lg md:text-xl text-muted-foreground">{t.page_subtitle}</p>
            </div>

            {/* Panel Navigation Indicator - only show when we have results */}
            {hasResults && (
              <div ref={panelNavRef} className="flex items-center justify-center gap-2 mb-6">
                <button
                  onClick={() => setCurrentPanel("upload")}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-3.5 rounded-full text-lg md:text-xl font-bold transition-all ${
                    currentPanel === "upload"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Camera className="w-5 h-5 md:w-6 md:h-6" />
                  {t.panel_upload}
                </button>
                <button
                  onClick={() => setCurrentPanel("results")}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-3.5 rounded-full text-lg md:text-xl font-bold transition-all ${
                    currentPanel === "results"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                  {t.panel_results}
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
                UPLOAD PANEL - Primary screen for elderly users
            ═══════════════════════════════════════════════════════════════════════════ */}
            {currentPanel === "upload" && (
              <div ref={uploadPanelRef} className="space-y-4">
                {/* Main Upload Area */}
                <div className="bg-card rounded-2xl border-2 border-primary/20 p-6 shadow-sm">
                  <h3 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2 text-center justify-center">
                    <Camera className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                    {t.upload_title}
                  </h3>

                  {isUploading ? (
                    <div className="border-2 border-dashed border-primary/40 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[280px]">
                      <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                      <p className="text-lg font-semibold text-primary">{t.uploading}</p>
                    </div>
                  ) : uploadedImages.length > 0 ? (
                    <div>
                      {/* Photo count indicator */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <span className={`text-base md:text-lg font-bold ${uploadedImages.length >= MAX_IMAGES ? "text-amber-600" : "text-muted-foreground"}`}>
                          {t.max_photos} ({uploadedImages.length}/{MAX_IMAGES})
                        </span>
                        {uploadedImages.length > 1 && (
                          <button
                            onClick={removeAllImages}
                            className="flex items-center gap-2 px-4 py-2 text-base font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-xl border border-destructive/30 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                            {t.delete_all}
                          </button>
                        )}
                      </div>

                      {/* Max photos warning */}
                      {uploadedImages.length >= MAX_IMAGES && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-base font-semibold px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                          <Info className="w-5 h-5 shrink-0" />
                          {t.max_photos_warning}
                        </div>
                      )}

                      {/* Image grid */}
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
                        {uploadedImages.map((img, index) => (
                          <div key={index} className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary group">
                            <Image src={img} alt={`Uploaded ${index + 1}`} fill className="object-cover cursor-pointer" onClick={() => openImageModal(img)} />
                            <button
                              onClick={(e) => { e.stopPropagation(); removeImage(index) }}
                              className="absolute top-1 right-1 z-20 bg-foreground text-background rounded-full w-8 h-8 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-md"
                              aria-label="Remove image"
                            >
                              <X className="w-5 h-5" />
                            </button>
                            <div className="absolute inset-0 z-10 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center pointer-events-none">
                              <ZoomIn className="w-6 h-6 text-background opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ))}
                        {/* Add more photo button in grid */}
                        {uploadedImages.length < MAX_IMAGES && (
                          <button
                            onClick={handleAddPhotoClick}
                            className="aspect-square rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                          >
                            <Plus className="w-10 h-10 text-primary mb-1" />
                          </button>
                        )}
                      </div>

                      {/* Add Photo Button */}
                      {uploadedImages.length < MAX_IMAGES && (
                        <button
                          onClick={handleAddPhotoClick}
                          className="w-full flex items-center justify-center gap-3 bg-primary/10 text-primary font-bold text-lg py-4 px-4 rounded-xl hover:bg-primary/20 border-2 border-primary/30"
                        >
                          <Camera className="w-6 h-6" />
                          {t.upload_btn}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Empty state - Large upload area */}
                      <div
                        className="border-2 border-dashed border-primary/40 rounded-2xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer min-h-[200px] flex flex-col items-center justify-center"
                        onClick={handleAddPhotoClick}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files) }}
                      >
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                          <Camera className="w-10 h-10 text-primary" />
                        </div>
                        <p className="text-lg md:text-xl font-semibold text-foreground mb-2">{t.upload_hint}</p>
                        <p className="text-base md:text-lg text-muted-foreground">{t.upload_format}</p>
                      </div>

                      {/* Large Take Photo Button */}
                      <button
                        onClick={handleAddPhotoClick}
                        className="mt-4 w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground font-bold text-xl py-5 px-4 rounded-2xl hover:opacity-90 shadow-lg"
                      >
                        <Camera className="w-7 h-7" />
                        {t.camera_btn}
                      </button>
                    </>
                  )}

                  {/* Hidden file inputs */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    suppressHydrationWarning
                    className="hidden"
                    onChange={(e) => { handleFileUpload(e.target.files); e.target.value = "" }}
                  />
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

                {/* Text Input Toggle - Secondary feature */}
                {!showTextInput ? (
                  <button
                    onClick={() => setShowTextInput(true)}
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 text-lg md:text-xl font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-2xl border-2 border-primary/30 transition-colors"
                  >
                    <Type className="w-6 h-6 md:w-7 md:h-7" />
                    {t.type_food_instead}
                  </button>
                ) : (
                  <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                        <Utensils className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                        {t.text_input_title}
                      </h3>
                      <button
                        onClick={() => { setShowTextInput(false); setTextInput("") }}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-base md:text-lg text-muted-foreground mb-3">{t.text_input_hint}</p>
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
                      className="w-full h-[120px] p-4 rounded-xl border border-border bg-background text-lg md:text-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    />
                  </div>
                )}

                {/* Analyse Button */}
                {showAnalyzeButton && (
                  <button
                    ref={analyzeButtonRef}
                    onClick={() => handleAnalyze(lang)}
                    disabled={isAnalyzing}
                    className="w-full flex items-center justify-center gap-3 bg-accent text-accent-foreground font-bold text-xl px-8 py-5 rounded-2xl hover:opacity-90 transition-opacity shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-7 h-7" />
                    {t.analyze_btn}
                  </button>
                )}

                {/* Loading State */}
                {isAnalyzing && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="34" stroke="var(--color-primary)" strokeOpacity="0.15" strokeWidth="8" />
                        <circle cx="40" cy="40" r="34" stroke="var(--color-primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray="53 160" />
                      </svg>
                    </div>
                    <p className="text-lg md:text-xl font-semibold text-primary">{t.scanning_steps[scanStep]}</p>
                  </div>
                )}

                {/* Error */}
                {analyzeError && !isAnalyzing && (
                  <div className="bg-[var(--risk-high-bg)] border border-red-700/30 rounded-xl px-6 py-4 text-red-700 font-semibold text-lg md:text-xl text-center">
                    <Info className="inline w-5 h-5 mr-2 mb-0.5" />
                    {analyzeError}
                  </div>
                )}

                {/* Success Count */}
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

                {/* Navigate to Results Button - Show when results exist */}
                {hasResults && !isAnalyzing && successCount === null && (
                  <button
                    onClick={() => setCurrentPanel("results")}
                    className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground font-bold text-xl py-5 rounded-2xl hover:opacity-90 shadow-lg"
                  >
                    {t.view_your_results}
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}

                {/* Photo Tips - Simplified */}
                <div className="bg-primary/5 rounded-2xl border border-primary/20 p-5 md:p-6">
                  <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-primary">
                    <Info className="w-5 h-5 md:w-6 md:h-6" />
                    {t.guide_title}
                  </h3>
                  <ul className="space-y-3 text-base md:text-lg text-foreground/80">
                    {t.guide_steps.map((step, i) => {
                      // Map icons based on the icon key
                      const iconMap: Record<string, React.ReactNode> = {
                        camera: <Smartphone className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0 mt-0.5" />,
                        light: <Sun className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0 mt-0.5" />,
                        food: <Utensils className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0 mt-0.5" />,
                        split: <Utensils className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0 mt-0.5" />,
                        clear: <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0 mt-0.5" />,
                      }
                      return (
                        <li key={i} className="flex items-start gap-3">
                          {iconMap[step.icon] || <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0 mt-0.5" />}
                          {step.text}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
                RESULTS PANEL - Shows after analysis
            ═══════════════════════════════════════════════════════════════════════════ */}
            {currentPanel === "results" && hasResults && (
              <div className="space-y-4" id="analysis-result-section">
                {/* Category Selection */}
                {showCategoryTabs && (
                  <div ref={categoryTabsRef} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                    <h2 className="text-xl md:text-2xl font-bold mb-2 text-center">{t.select_category}</h2>
                    <p className="text-muted-foreground text-center text-base md:text-lg mb-4">{t.select_category_hint}</p>
                    <div className={`grid gap-2 w-full ${getAvailableCategories(apiResultsCache).length === 1 ? "grid-cols-1" : getAvailableCategories(apiResultsCache).length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
                      {getAvailableCategories(apiResultsCache).includes("appetizer") && (
                        <button
                          onClick={() => handleCategorySelect("appetizer")}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                            selectedCategory === "appetizer"
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <Salad className="w-5 h-5 text-primary" />
                          <span className="text-base md:text-lg font-bold">{t.categories.appetizer}</span>
                        </button>
                      )}
                      {getAvailableCategories(apiResultsCache).includes("main") && (
                        <button
                          onClick={() => handleCategorySelect("main")}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                            selectedCategory === "main"
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <Utensils className="w-5 h-5 text-primary" />
                          <span className="text-base md:text-lg font-bold">{t.categories.main}</span>
                        </button>
                      )}
                      {getAvailableCategories(apiResultsCache).includes("dessert") && (
                        <button
                          onClick={() => handleCategorySelect("dessert")}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                            selectedCategory === "dessert"
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <Cake className="w-5 h-5 text-primary" />
                          <span className="text-base md:text-lg font-bold">{t.categories.dessert}</span>
                        </button>
                      )}
                      {getAvailableCategories(apiResultsCache).includes("drink") && (
                        <button
                          onClick={() => handleCategorySelect("drink")}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                            selectedCategory === "drink"
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <GlassWater className="w-5 h-5 text-primary" />
                          <span className="text-base md:text-lg font-bold">{t.categories.drink}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {results && results.length === 0 && (
                  <div className="bg-[var(--cb-pink)] border border-[#8b3a62]/30 rounded-2xl p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[#8b3a62]/10 rounded-full flex items-center justify-center">
                      <Info className="w-8 h-8 text-[#8b3a62]" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold mb-2 text-[#8b3a62]">{t.no_results}</h3>
                    <p className="text-base md:text-lg text-foreground/80 mb-6">{t.no_results_hint}</p>
                  </div>
                )}

                {/* Results List */}
                {results && results.length > 0 && (
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3">{t.result_title} - {t.categories[selectedCategory as keyof typeof t.categories]}</h2>
                    
                    {/* Disclaimer */}
                    <div className="bg-slate-100 rounded-xl px-4 py-3 mb-3 flex items-start gap-2 border border-slate-200">
                      <Info className="w-5 h-5 shrink-0 mt-0.5 text-slate-600" />
                      <p className="text-base md:text-lg text-slate-600">{t.disclaimer}</p>
                    </div>

                    {/* Top 3 explanation */}
                    <div className="bg-[var(--risk-low-bg)] border border-[var(--risk-low)]/30 rounded-2xl px-4 py-3 mb-4 flex items-start gap-2">
                      <Star className="w-5 h-5 text-[var(--risk-low)] shrink-0 mt-0.5" />
                      <p className="text-base md:text-lg font-semibold text-[var(--risk-low)]">{t.top3_disclaimer}</p>
                    </div>

                    {/* Food cards */}
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
                  </div>
                )}

                {/* Navigation buttons at bottom of results */}
                <div className="flex gap-3 pt-4">
                  {/* Back to Category button */}
                  {results && results.length > 0 && getAvailableCategories(apiResultsCache).length > 1 && (
                    <button
                      onClick={() => {
                        handleAnalyzeAnother()
                        setTimeout(() => {
                          categoryTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }, 50)
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground font-bold text-lg py-4 rounded-2xl hover:bg-muted/80 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      {t.back_to_category}
                    </button>
                  )}
                </div>

                {/* Try Another Photo / Start Over */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCurrentPanel("upload")
                      // Scroll to upload panel so user can see the function to add photo
                      setTimeout(() => {
                        uploadPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }, 100)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground font-bold text-base py-3.5 rounded-2xl hover:opacity-90"
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t.try_another_photo}</span>
                  </button>
                  <button
                    onClick={() => {
                      clearAll()
                      // Scroll to upload panel after clearing
                      setTimeout(() => {
                        uploadPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }, 100)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 border-2 border-border text-foreground font-semibold text-base py-3.5 rounded-2xl hover:bg-muted"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t.analyze_new_food}</span>
                  </button>
                </div>
              </div>
            )}

{/* Image Modal */}
      {showImageModal && modalImage && (
        <div className="fixed inset-0 bg-foreground/80 z-50 flex items-center justify-center p-4 pt-20" onClick={() => setShowImageModal(false)}>
          <div className="relative max-w-4xl w-full max-h-[80vh]">
            <button onClick={() => setShowImageModal(false)} className="absolute -top-14 right-0 text-background hover:text-muted p-2 z-10">
              <X className="w-10 h-10" />
            </button>
            <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden">
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

                    {/* Cancel */}
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

          {!cartOpen && (
            <ViewPlanButton label={t.view_cart} onClick={() => setCartOpen(true)} />
          )}

          <DailyIntakePanel
            t={dailyIntakePanelContent[lang]}
            isOpen={cartOpen}
            onClose={() => setCartOpen(false)}
            lang={lang}
          />
          </>
        )
      }}
    </PageLayout>
  )
}
