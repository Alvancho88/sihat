"use client";

// components/AIChatbot.tsx
// Epic 9: AI Conversational Health Assistant
//
// This is the main chatbot UI component for the SIHAT application.
// It renders a floating button accessible from every page and a slide-up
// chat panel that users can interact with in English, Bahasa Malaysia, or
// Simplified Chinese.
//
// Key responsibilities:
//   - Renders the floating assistant button and the chat panel (open/close)
//   - Manages conversation state, language detection, and session persistence
//   - Reads food scan results from sessionStorage (written by recommendation page)
//   - Sends user messages to /api/chat and applies the structured response
//   - Handles cart (meal plan) add/remove/clear from chat commands
//   - Supports voice input via Web Speech API (non-auto-send; user reviews first)
//   - Supports food photo upload → /api/predict for in-chat menu scanning
//   - Coordinates "View Detailed Analysis" navigation with the recommendation page
//
// Architecture notes:
//   - Conversation language is tracked separately from page UI language
//     so users can type in a different language and get replies in that language
//   - SessionStorage is used for cross-page scan context sharing
//   - Analysis hint events (CustomEvent) are used for cross-page real-time sync
//   - Cart state comes from CartContext (shared with the food page)
//   - Daily intake summary is computed client-side before each API request

import { Fragment, useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  X,
  Send,
  Loader2,
  ChevronDown,
  Plus,
  Check,
  Mic,
  ImagePlus,
  Copy,
  RefreshCw,
  Square,
  Trash2,
  Utensils,
  ClipboardList,
  BookOpen,
  UserRound,
} from "lucide-react";
import { useCart } from "@/components/cart-context";
import { buildDailyIntakeSummary, type Gender, type DailyIntakeSummary } from "@/lib/daily-intake-summary";
import { type FoodItem as CartFoodItem } from "@/lib/food-functions";
import { computeRiskFromIndicators, parseNutrientNumber } from "@/lib/food-recognition-risk";
import {
  ANALYSIS_READY_EVENT,
  ANALYSIS_SESSION_KEY as SHARED_ANALYSIS_SESSION_KEY,
  buildStableAnalysisSessionId,
  extractFoodNamesFromPredictResults,
  notifyAnalysisReady,
  readAcknowledgedAnalysisHintId,
  markAnalysisHintAcknowledged,
  clearAcknowledgedAnalysisHintId,
  readAnalysisIdFromSession,
  type AnalysisReadyDetail,
  type AnalysisReadySource,
} from "@/lib/analysis-hint-sync";

// ─── TYPES ────────────────────────────────────────────────────────────────────

/**
 * The three supported UI / conversation languages for SIHAT.
 * Used throughout the component to select localized strings and
 * to tell the /api/chat endpoint which language to respond in.
 */
type LangCode = "en" | "ms" | "zh";

/**
 * Constructor type for the browser's SpeechRecognition API.
 * Accessed via window.SpeechRecognition or window.webkitSpeechRecognition
 * (vendor-prefixed on Chrome/Safari). We define our own interface instead of
 * relying on the built-in TS DOM lib because this API is not uniformly typed
 * across all target environments.
 */
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

/**
 * Represents a single recognition result returned during a speech session.
 * `isFinal` is true once the browser has committed the transcript for that
 * utterance. Each result object is also indexable to retrieve the alternative
 * transcripts (we only use index [0], which is the best guess).
 */
interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

/**
 * Event fired by the SpeechRecognition API each time speech is recognised.
 * `resultIndex` tells us where in the results list new entries begin so we
 * can append rather than re-process already-committed results.
 */
interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
}

/**
 * Error event fired when the SpeechRecognition API encounters a problem
 * (e.g., microphone permission denied, network failure, no speech detected).
 */
interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

/**
 * Full interface for the browser SpeechRecognition object.
 * We keep our own definition because the `@types/dom` entry is absent in
 * some TypeScript setups and we only need a subset of the full API.
 */
interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/**
 * Extends the standard browser Window with the (possibly vendor-prefixed)
 * SpeechRecognition constructor so TypeScript doesn't complain when we look
 * up window.SpeechRecognition or window.webkitSpeechRecognition at runtime.
 */
type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

/**
 * Summary of a single food item derived from a scan result.
 * Used by the chat UI to render food cards inline in the message bubble.
 * Nutrient values are stored as numbers so the risk computation helper
 * (`computeRiskFromIndicators`) can work directly on them.
 *
 * `category` is the scan bucket the food belongs to (Main Dish, Appetizer,
 * etc.) and is used for grouping when showing multi-category scan results.
 */
interface ScanFoodSummary {
  name: string;
  risk: "Low" | "Medium" | "High";
  tip: string;
  category?: keyof Omit<ScanContext, "uniqueFoodCount">;
  sugarG: number;
  sodiumMg: number;
  fatG: number;
}

/**
 * Category labels used by the AI-estimated food card path.
 * Mirrors the categories in ScanContext but uses singular/title-case form
 * for display and for mapping back to the correct session-storage bucket.
 */
type EstimatedFoodCategory = "Main Dish" | "Appetizer" | "Dessert" | "Drink";

/**
 * A food card returned by /api/chat when the food is NOT in the SIHAT
 * database and the API falls back to AI estimation (Groq LLM).
 * Optional nutrient fields may be absent if the model could not estimate them;
 * the UI handles NaN gracefully by skipping the numeric risk override.
 */
interface EstimatedFoodCard {
  name: string;
  category: EstimatedFoodCategory | null;
  risk: "low" | "medium" | "high";
  tip: string;
  sugar?: number;
  sodium?: number;
  fat?: number;
}

/**
 * A single message in the chat conversation.
 *
 * Core fields (`role`, `content`, `id`) are always present.
 * The remaining optional fields carry structured payloads that the UI
 * renders as food cards, quick-reply chips, or action buttons:
 *
 *   - `locale`            — language the assistant used for this reply;
 *                           controls which strings are shown on buttons/labels.
 *   - `kind: "system"`    — italic system notice (language switch, reset, etc.)
 *   - `suggestions`       — DB-matched foods the user can add to their meal plan.
 *   - `unavailableFoodName` — food name when no DB match was found (shown grayed out).
 *   - `scanFood`          — single food from a photo/menu scan.
 *   - `scanFoods`         — multiple foods from a multi-item photo scan.
 *   - `quickReplies`      — pre-built reply chips the user can tap.
 *   - `starterQuestions`  — shown only on the welcome message; triggers onboarding flow.
 *   - `actionButton`      — CTA button (e.g., "View Detailed Analysis", "Open Food Page").
 *   - `isMultiFood`       — true when this message contains cards for multiple foods.
 *   - `estimatedFood`     — single AI-estimated food card (not in DB).
 *   - `estimatedFoods`    — multiple AI-estimated food cards.
 */
interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  /** Language used for this assistant turn (detected from user input / API request). */
  locale?: LangCode;
  kind?: "system";
  suggestions?: CartFoodItem[];
  unavailableFoodName?: string;
  scanFood?: ScanFoodSummary;
  scanFoods?: ScanFoodSummary[];
  quickReplies?: string[];
  starterQuestions?: readonly string[];
  actionButton?: {
    label: string;
    href: string;
  };
  isMultiFood?: boolean;
  estimatedFood?: EstimatedFoodCard;
  estimatedFoods?: EstimatedFoodCard[];
}

/**
 * An image the user has staged for upload but not yet sent.
 * `url` is a temporary object URL created with URL.createObjectURL() and must
 * be revoked when the image is removed or the component unmounts.
 */
interface PendingChatImage {
  id: string;
  file: File;
  url: string;
}

/**
 * Returns true when the conversation is still in its initial "seed" state,
 * meaning no real user messages have been sent yet and no food cards have
 * appeared in the thread.
 *
 * This is used to decide whether a page-language change should silently
 * replace the welcome message (seed state → swap) or insert a visible
 * "switched to X language" notice into the existing conversation.
 *
 * A message counts as non-seed if it is a user message OR an assistant
 * message that carries structured payload (suggestions, food cards, etc.).
 * System notices (kind === "system") and the initial welcome message with
 * starter questions are not considered real conversation content.
 */
function isChatInInitialSeedState(messages: Message[]): boolean {
  for (const m of messages) {
    if (m.role === "user") return false;
    if (m.role === "assistant") {
      if (m.kind === "system") continue;
      if (m.starterQuestions?.length) continue;
      if (
        m.suggestions?.length ||
        m.estimatedFood ||
        m.estimatedFoods?.length ||
        m.scanFood ||
        m.scanFoods?.length ||
        m.isMultiFood ||
        (m.quickReplies && m.quickReplies.length > 0) ||
        m.actionButton
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * The shape of the food-scan result stored in sessionStorage by /api/predict
 * (also produced by the chatbot's inline photo analysis and by typed-food flows).
 *
 * Each category key holds a ranked list of `FoodItem` objects.
 * `uniqueFoodCount` is a convenience count used to quickly tell whether any
 * category has real data without iterating all buckets.
 *
 * Note: the key "Drinks" (plural) is used here, whereas the EstimatedFoodCategory
 * type uses "Drink" (singular) — the mapping is handled in scanBucketForEstimatedCategory.
 */
// Shape of what /api/predict stores — mirrors the API response
interface ScanContext {
  "Appetizer"?: { ranking: FoodItem[] };
  "Main Dish"?: { ranking: FoodItem[] };
  "Dessert"?: { ranking: FoodItem[] };
  "Drinks"?: { ranking: FoodItem[] };
  uniqueFoodCount?: number;
}

/**
 * A single food item as stored inside a ScanContext ranking array.
 * Fields use short keys (f, sugar, salt, fat) because the data originates
 * from the database and is serialised into sessionStorage; keeping keys short
 * reduces payload size slightly.
 *
 * `tip` and `best_reason` can be either a plain string (legacy) or a
 * Record<LangCode, string> object (new multilingual format from /api/predict).
 * Consumers must handle both shapes.
 *
 * `db_matched` indicates whether the food was found in the SIHAT database
 * (true) or estimated by the AI model (false / absent).
 */
interface FoodItem {
  f: string;
  sugar: number;
  salt: number;
  fat: number;
  calories?: number;
  gi?: number;
  risk: "Low" | "Medium" | "High";
  tip?: string | Partial<Record<LangCode, string>>;
  best_reason?: string | Partial<Record<LangCode, string>>;
  db_matched?: boolean;
}

/**
 * The minimal chat message shape sent to /api/chat as conversation history.
 * We deliberately strip out all UI-only fields (locale, suggestions, etc.)
 * so the API payload stays small and the LLM doesn't see internal metadata.
 */
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * The structured response returned by /api/chat.
 *
 *   - `reply`           — the localized text to display in the chat bubble.
 *   - `action`          — optional cart mutation (add/remove/clear) to execute.
 *   - `suggestions`     — DB-matched foods the user can add to their meal plan.
 *   - `unavailableFoodName` — set when the food is not in the DB.
 *   - `quickReplies`    — pre-built follow-up chips.
 *   - `actionButton`    — CTA linking to /recommendation, /learn, or /food.
 *   - `isMultiFood`     — true when the reply covers more than one food item.
 *   - `estimatedFood`   — single AI-estimated food card.
 *   - `estimatedFoods`  — list of AI-estimated food cards.
 */
interface ChatResponse {
  reply?: string;
  action?: {
    type: "add" | "remove" | "clear";
    food?: CartFoodItem;
  };
  suggestions?: CartFoodItem[];
  unavailableFoodName?: string;
  quickReplies?: string[];
  actionButton?: {
    label: string;
    href: string;
  };
  isMultiFood?: boolean;
  estimatedFood?: EstimatedFoodCard;
  estimatedFoods?: EstimatedFoodCard[];
}

/**
 * The JSON body sent with every POST to /api/chat.
 *
 * Sending the full cart and daily intake summary with each request means the
 * API can give contextually relevant advice (e.g., "you've already had a lot
 * of sugar today") without the server needing to maintain session state.
 */
type ChatRequestBody = {
  message: string;
  history: ChatMessage[];
  language: LangCode;
  scanContext: ScanContext | null;
  cart: CartFoodItem[];
  intakeSummary: DailyIntakeSummary;
};

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
//
// `t` is the master translations object for all UI strings used inside the
// chatbot panel.  It is indexed by LangCode so callers can look up the right
// locale with `t[lang]`.
//
// Having all strings in one place makes it easy to add a new language or spot
// missing translations.  Each locale object uses the same keys, so TypeScript
// will warn us if a key is present in "en" but missing in "ms" or "zh".
//
// The `as const` assertion at the end freezes the object so individual string
// values are inferred as literal types rather than `string` — this is important
// for `starterQuestions: tx.suggestedQ` where the type must be `readonly string[]`.

const t = {
  en: {
    title: "SIHAT Assistant",
    subtitle: "Helping you make healthier food choices",
    placeholder: "Ask about food or the Three Highs...",
    send: "Send",
    clearChat: "Clear chat",
    clearConfirm: "Clear this conversation?",
    copied: "Copied.",
    copyFailed: "Copy failed",
    copyReply: "Copy",
    tryAgain: "Try again",
    stopResponding: "Stop responding",
    responseStopped: "Response stopped. You can ask another question anytime.",
    voiceStart: "Start voice input",
    voiceStop: "Stop listening",
    listening: "Recording... Tap again to stop",
    voiceNoSpeech: "I couldn't hear clearly. Please try again.",
    scanFood: "Analyse my food photo",
    uploadFoodPhoto: "Upload food photo",
    imageUnsupported: "Image upload is not supported on this device.",
    uploadPhotoUser: "Food photo uploaded.",
    maxPhotos: "Maximum 5 photos",
    removePhoto: "Remove photo",
    previewPhoto: "Preview photo",
    photoAnalysing: "Analysing your food photo...",
    photoFailed: "Sorry, I could not analyse this photo. Please try again.",
    noFoodDetected: "I could not detect food clearly. Please try another photo.",
    foundFoods: "I found these foods:",
    foundCategories: "Food groups found:",
    highNutrientSummary: "Some items may be high in fat or sodium.",
    openFullAnalysis: "View Detailed Analysis",
    addToMealPlan: "Add to Meal Plan",
    inMealPlan: "Added to Meal Plan",
    tapAgainToRemove: "Tap again to remove",
    removedFromMealPlan: "Removed from meal plan",
    openLearnPage: "Open Learn Page",
    openFoodPage: "Open Food Page",
    cartAdded: "added to your meal plan.",
    cartAlreadyIn: "is already in your meal plan.",
    cartRemoved: "removed from your meal plan.",
    cartNotIn: "is not in your meal plan.",
    cartNotAvailable: "This food is not currently in the SIHAT food database. The nutrition information and health advice shown here are estimated by AI and may not be fully accurate.",
    cartNoContext: "Please tell me which food you would like to add first.",
    sitiResponding: "Siti is responding…",
    stop: "Stop",
    foodDetected: "Food detected",
    disclaimer: "General guidance only — please consult your doctor for personal medical advice.",
    welcome:
      "Hello! I'm Siti, your SIHAT health assistant. Ask me about food choices, diabetes, or the Three Highs.",
    scanFound:
      "💡 I can see your food analysis is ready. Ask me about your food choices and I'll give you personalised advice.",
    noScan: "No food scan found. Try scanning a menu first for personalised advice!",
    analysisReset: "Analysis reset. You can upload a new photo or type another food.",
    thinking: "Thinking...",
    errorRetry: "Something went wrong. Please try again.",
    stillUnavailable: "Sorry, that food is not in our food list.",
    ariaOpen: "Open health assistant",
    ariaClose: "Close health assistant",
    suggestedQ: [
      "Check my food or menu",
      "Help me plan today's meals",
      "Learn about diabetes, blood pressure & cholesterol",
    ],
    foodCheckGuide:
      "I can help check your food choices.\n\nYou can:\n• Upload a food photo\n• Upload a menu photo\n• Take a photo\n• Type food names\n\nI will analyze the food and explain:\n• Risk level\n• Healthier choices\n• Health tips",
    mealPlanGuide:
      "I can help you plan healthier meals for today.\n\nYou can:\n• Add foods to your meal plan\n• Build breakfast, lunch, and dinner\n• Choose healthier options\n• Track better choices for the Three Highs\n\nYou can start by:\n• Typing a food name\n• Opening Food Analysis\n• Or choosing foods from your Food page",
    learnGuide:
      "I can help you learn about:\n• Diabetes\n• High blood pressure\n• Cholesterol",
    languageSwitched: "From now on, I will reply in English.",
  },
  ms: {
    title: "Pembantu SIHAT",
    subtitle: "Membantu anda membuat pilihan makanan lebih sihat",
    placeholder: "Tanya makanan atau Tiga Tinggi...",
    send: "Hantar",
    clearChat: "Kosongkan perbualan",
    clearConfirm: "Kosongkan perbualan ini?",
    copied: "Disalin.",
    copyFailed: "Gagal disalin",
    copyReply: "Salin",
    tryAgain: "Cuba semula",
    stopResponding: "Hentikan jawapan",
    responseStopped: "Jawapan dihentikan. Anda boleh tanya soalan lain pada bila-bila masa.",
    voiceStart: "Mulakan input suara",
    voiceStop: "Berhenti mendengar",
    listening: "Sedang merakam... Tekan sekali lagi untuk berhenti",
    voiceNoSpeech: "Saya tidak dengar dengan jelas. Sila cuba lagi.",
    scanFood: "Analisis foto makanan saya",
    uploadFoodPhoto: "Muat naik foto makanan",
    imageUnsupported: "Muat naik imej tidak disokong pada peranti ini.",
    uploadPhotoUser: "Foto makanan dimuat naik.",
    maxPhotos: "Maksimum 5 foto",
    removePhoto: "Buang foto",
    previewPhoto: "Pratonton foto",
    photoAnalysing: "Sedang menganalisis foto makanan anda...",
    photoFailed: "Maaf, saya tidak dapat menganalisis foto ini. Sila cuba lagi.",
    noFoodDetected: "Saya tidak dapat mengesan makanan dengan jelas. Sila cuba foto lain.",
    foundFoods: "Saya menjumpai makanan ini:",
    foundCategories: "Kumpulan makanan dijumpai:",
    highNutrientSummary: "Sesetengah item mungkin tinggi lemak atau natrium.",
    openFullAnalysis: "Lihat Analisis Penuh",
    addToMealPlan: "Tambah ke Pelan Makanan",
    inMealPlan: "Ditambah ke Pelan Makanan",
    tapAgainToRemove: "Ketuk lagi untuk buang",
    removedFromMealPlan: "Dibuang daripada pelan makanan",
    openLearnPage: "Buka Halaman Belajar",
    openFoodPage: "Buka Halaman Makanan",
    cartAdded: "ditambah ke pelan makanan anda.",
    cartAlreadyIn: "sudah ada dalam pelan makanan anda.",
    cartRemoved: "dibuang dari pelan makanan anda.",
    cartNotIn: "tidak ada dalam pelan makanan anda.",
    cartNotAvailable: "Makanan ini tidak terdapat dalam pangkalan data makanan SIHAT. Maklumat pemakanan dan nasihat kesihatan yang ditunjukkan di sini dianggarkan oleh AI dan mungkin tidak sepenuhnya tepat.",
    cartNoContext: "Sila beritahu saya makanan yang ingin anda tambah dahulu.",
    sitiResponding: "Siti sedang menjawab…",
    stop: "Berhenti",
    foodDetected: "Makanan dikesan",
    disclaimer: "Panduan umum sahaja — sila berjumpa doktor untuk nasihat perubatan peribadi.",
    welcome:
      "Helo! Saya Siti, pembantu kesihatan SIHAT anda. Tanya saya tentang pilihan makanan, diabetes, atau Tiga Tinggi.",
    scanFound:
      "💡 Analisis makanan anda sudah sedia. Tanya saya tentang pilihan makanan untuk nasihat peribadi.",
    noScan: "Tiada imbasan makanan ditemui. Cuba imbas menu dahulu untuk nasihat peribadi!",
    analysisReset: "Analisis telah dikosongkan. Anda boleh muat naik gambar baharu atau taip makanan lain.",
    thinking: "Sedang berfikir...",
    errorRetry: "Ada masalah. Sila cuba lagi.",
    stillUnavailable: "Maaf, makanan itu tidak ada dalam senarai makanan kami.",
    ariaOpen: "Buka pembantu kesihatan",
    ariaClose: "Tutup pembantu kesihatan",
    suggestedQ: [
      "Semak makanan atau menu saya",
      "Bantu saya rancang makanan hari ini",
      "Belajar tentang diabetes, tekanan darah & kolesterol",
    ],
    foodCheckGuide:
      "Saya boleh membantu menyemak pilihan makanan anda.\n\nAnda boleh:\n• Muat naik foto makanan\n• Muat naik foto menu\n• Ambil foto\n• Taip nama makanan\n\nSaya akan menganalisis makanan dan menerangkan:\n• Tahap risiko\n• Pilihan lebih sihat\n• Tips kesihatan",
    mealPlanGuide:
      "Saya boleh membantu anda merancang makanan lebih sihat untuk hari ini.\n\nAnda boleh:\n• Tambah makanan ke pelan makanan anda\n• Rancang sarapan, makan tengah hari dan makan malam\n• Pilih pilihan lebih sihat\n• Jejak pilihan lebih baik untuk Tiga Tinggi\n\nAnda boleh mula dengan:\n• Taip nama makanan\n• Buka Analisis Makanan\n• Atau pilih makanan dari halaman Makanan anda",
    learnGuide:
      "Saya boleh membantu anda belajar tentang:\n• Diabetes\n• Tekanan darah tinggi\n• Kolesterol",
    languageSwitched: "Mulai sekarang, saya akan menjawab dalam Bahasa Malaysia.",
  },
  zh: {
    title: "SIHAT 健康助手",
    subtitle: "帮助您选择更健康的食物",
    placeholder: "询问食物或三高…",
    send: "发送",
    clearChat: "清除对话",
    clearConfirm: "清除这段对话？",
    copied: "已复制。",
    copyFailed: "复制失败",
    copyReply: "复制",
    tryAgain: "重新回答",
    stopResponding: "停止",
    responseStopped: "回复已停止。您可以随时再问问题。",
    voiceStart: "开始语音输入",
    voiceStop: "停止聆听",
    listening: "正在录音… 再点一次即可停止",
    voiceNoSpeech: "我听不清楚，请再试一次。",
    scanFood: "分析我的食物照片",
    uploadFoodPhoto: "上传食物照片",
    imageUnsupported: "此设备不支持图片上传。",
    uploadPhotoUser: "已上传食物照片。",
    maxPhotos: "最多 5 张照片",
    removePhoto: "移除照片",
    previewPhoto: "预览照片",
    photoAnalysing: "正在分析您的食物照片…",
    photoFailed: "抱歉，我无法分析这张照片。请再试一次。",
    noFoodDetected: "我无法清楚识别食物。请换一张照片再试。",
    foundFoods: "我找到这些食物：",
    foundCategories: "找到的食物类别：",
    highNutrientSummary: "部分食物的脂肪或钠含量可能较高。",
    openFullAnalysis: "查看完整食物分析",
    addToMealPlan: "加入每日餐点计划",
    inMealPlan: "已加入每日餐点计划",
    tapAgainToRemove: "再次点击可移除",
    removedFromMealPlan: "已从每日餐点计划中移除",
    openLearnPage: "打开学习页面",
    openFoodPage: "打开食物页面",
    cartAdded: "已加入您的每日餐点计划。",
    cartAlreadyIn: "已在您的每日餐点计划中。",
    cartRemoved: "已从您的每日餐点计划中移除。",
    cartNotIn: "不在您的每日餐点计划中。",
    cartNotAvailable: "此食物目前不在SIHAT食物数据库中。此处显示的营养信息和健康建议由AI估算，可能并不完全准确。",
    cartNoContext: "请先告诉我您想加入哪种食物。",
    sitiResponding: "Siti 正在回复…",
    stop: "停止",
    foodDetected: "已检测到食物",
    disclaimer: "仅供一般健康参考，个人医疗建议请咨询医生。",
    welcome:
      "您好！我是 Siti，您的 SIHAT 健康助手。您可以询问食物选择、糖尿病或三高相关问题。",
    scanFound: "💡 我看到您的食物分析已准备好。向我询问您的食物选择，我将为您提供个性化建议。",
    noScan: "未找到食物扫描记录。请先扫描菜单以获取个性化建议！",
    analysisReset: "分析已重置。您可以上传新的照片或输入其他食物。",
    thinking: "思考中…",
    errorRetry: "出现错误，请重试。",
    stillUnavailable: "抱歉，这个食物不在我们的食物列表中。",
    ariaOpen: "打开健康助手",
    ariaClose: "关闭健康助手",
    suggestedQ: [
      "检查我的食物或菜单",
      "帮我规划今天的饮食",
      "了解糖尿病、血压和胆固醇",
    ],
    foodCheckGuide:
      "我可以帮您检查食物选择。\n\n您可以：\n• 上传食物照片\n• 上传菜单照片\n• 拍照\n• 输入食物名称\n\n我会分析食物并说明：\n• 风险等级\n• 更健康的选择\n• 健康建议",
    mealPlanGuide:
      "我可以帮您规划今天更健康的饮食。\n\n您可以：\n• 将食物加入您的每日餐点计划\n• 规划早餐、午餐和晚餐\n• 选择更健康的选项\n• 追踪三高的更好选择\n\n您可以从以下开始：\n• 输入食物名称\n• 查看食物分析\n• 或从您的食物页面选择食物",
    learnGuide:
      "我可以帮您了解：\n• 糖尿病\n• 高血压\n• 胆固醇",
    languageSwitched: "从现在开始，我将使用简体中文回答。",
  },
} as const;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Reads the current food scan context from sessionStorage and parses it.
 *
 * The scan context is a JSON blob written by:
 *   a) /recommendation page after running /api/predict on a menu photo
 *   b) This chatbot component after in-chat photo analysis
 *   c) Typed-food analysis flow (user types food names → API → saveScanContext)
 *
 * Returns null if nothing is stored, the stored value is invalid JSON, or the
 * parsed object has no category data (i.e., all ranking arrays are empty).
 * Safe to call during SSR (returns null immediately when `window` is undefined).
 */
/** Reads food scan results from sessionStorage (stored by recommendation page) */
function readScanContext(): ScanContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCAN_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScanContext;
    return hasScanContextItems(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Generates a simple unique ID for messages */
// ─── Session storage keys & event names ───────────────────────────────────────

/** SessionStorage key for persisting the chat message history across page refreshes. */
const STORAGE_KEY = "sihat_assistant_messages";
/** SessionStorage key for the food scan result shared between the chatbot and the recommendation page. */
const SCAN_CONTEXT_KEY = "sihat_scan_results";
/** Re-exported alias of the shared analysis session key (from analysis-hint-sync.ts). */
const ANALYSIS_SESSION_KEY = SHARED_ANALYSIS_SESSION_KEY;
/** SessionStorage payload key used when chatbot navigates to /recommendation for AI-estimated (non-DB) foods. */
const CHATBOT_ESTIMATED_ANALYSIS_KEY = "sihat_chatbot_estimated_analysis";
/** CustomEvent name dispatched whenever the scan context in sessionStorage changes (add / clear). */
const SCAN_CONTEXT_EVENT = "sihat_scan_results_changed";
/** Maximum number of food photos a user can stage before sending. */
const MAX_CHAT_UPLOAD_IMAGES = 5;

/**
 * The set of analysis-ready event sources that should trigger the
 * "I can see your food analysis is ready" hint banner inside the chatbot.
 *
 * We intentionally exclude "chatbot-typed-only" source so that purely
 * text-based food lookups (no photo) don't cause a spurious hint banner
 * to appear when the user navigates back to the chatbot.
 */
const ANALYSIS_HINT_EVENT_SOURCES = new Set<AnalysisReadySource>([
  "food-recognition",
  "chatbot-view-detail",
  "recommendation-restore",
]);

/**
 * A simplified category label used when constructing or restoring an
 * analysis session from the chatbot.  Maps the four ScanContext bucket keys
 * to shorter identifiers consumed by the recommendation page's session object.
 */
type AnalysisSessionCategory = "main" | "appetizer" | "dessert" | "drink";

/**
 * Returns the first non-empty category in the scan context as an
 * `AnalysisSessionCategory`, in priority order: Main Dish → Appetizer →
 * Dessert → Drinks.  Returns null if the context has no ranked items at all.
 *
 * The recommendation page uses this value to pre-select the active category
 * tab when the user navigates from the chatbot via "View Detailed Analysis".
 *
 * @param ctx - A non-null ScanContext object.
 * @returns The first occupied category or null.
 */
function getFirstAnalysisCategory(ctx: ScanContext): AnalysisSessionCategory | null {
  const categoryMap: Array<[keyof Omit<ScanContext, "uniqueFoodCount">, AnalysisSessionCategory]> = [
    ["Main Dish", "main"],
    ["Appetizer", "appetizer"],
    ["Dessert", "dessert"],
    ["Drinks", "drink"],
  ];
  return categoryMap.find(([scanCategory]) => Boolean(ctx[scanCategory]?.ranking?.length))?.[1] ?? null;
}

/**
 * Dispatches a custom "sihat_scan_results_changed" event on the window.
 * This tells other components (e.g., the recommendation page listener) that
 * the scan context in sessionStorage has been modified by the chatbot so they
 * can re-read and refresh their UI without a full page reload.
 */
function notifyScanContextChanged() {
  window.dispatchEvent(new CustomEvent(SCAN_CONTEXT_EVENT, { detail: { source: "chatbot" } }));
}

/**
 * Writes a new scan context to sessionStorage and creates (or reuses) the
 * associated analysis session record.
 *
 * The function tries to be idempotent: if the raw JSON is identical to what
 * is already stored AND a valid session record already exists, it reuses the
 * existing `analysisId` and `createdAt` timestamps so that downstream
 * deduplication logic (in the analysis-hint-sync system) doesn't treat an
 * unchanged scan as a new event.
 *
 * After writing, it dispatches SCAN_CONTEXT_EVENT so all listeners (including
 * the recommendation page) are notified immediately.
 *
 * @param raw     - JSON-serialized ScanContext string.
 * @param session - Optional metadata to write into the analysis session record
 *                  (image previews, user text, pre-selected category).
 */
function saveScanContext(
  raw: string,
  session?: { imagePreviews?: string[]; userText?: string; selectedCategory?: AnalysisSessionCategory | null }
) {
  const result = JSON.parse(raw) as ScanContext;
  const foodNames = extractFoodNamesFromPredictResults(result as Record<string, unknown>);
  const prevScan = typeof window !== "undefined" ? sessionStorage.getItem(SCAN_CONTEXT_KEY) : null;
  let analysisId: string | undefined;
  let createdAt: number | undefined;
  try {
    const prevSessRaw = typeof window !== "undefined" ? sessionStorage.getItem(ANALYSIS_SESSION_KEY) : null;
    if (prevScan === raw && prevSessRaw) {
      const prevSess = JSON.parse(prevSessRaw) as { analysisId?: string; createdAt?: number };
      if (prevSess.analysisId && typeof prevSess.createdAt === "number") {
        analysisId = prevSess.analysisId;
        createdAt = prevSess.createdAt;
      }
    }
  } catch {
    /* use fresh id below */
  }
  if (analysisId === undefined || createdAt === undefined) {
    createdAt = Date.now();
    analysisId = buildStableAnalysisSessionId("chatbot", foodNames, createdAt);
  }
  sessionStorage.setItem(SCAN_CONTEXT_KEY, raw);
  if (session) {
    sessionStorage.setItem(
      ANALYSIS_SESSION_KEY,
      JSON.stringify({
        result,
        analysisId,
        imagePreviews: session.imagePreviews ?? [],
        userText: session.userText ?? "",
        selectedCategory: session.selectedCategory ?? null,
        createdAt,
        source: "chatbot",
      })
    );
  }
  notifyScanContextChanged();
}

/**
 * Removes all three chatbot-related sessionStorage entries (scan context,
 * analysis session, and the estimated-food analysis key) and also clears the
 * acknowledged analysis hint ID so the banner can reappear for a fresh scan.
 * Dispatches SCAN_CONTEXT_EVENT to notify all listeners.
 *
 * Called when:
 *   - The user explicitly clears the chat ("Clear chat" button)
 *   - The user says "reset analysis" in a chat message
 *   - The recommendation page reset button is clicked while chatbot is mounted
 */
function clearStoredScanContext() {
  sessionStorage.removeItem(SCAN_CONTEXT_KEY);
  sessionStorage.removeItem(ANALYSIS_SESSION_KEY);
  sessionStorage.removeItem(CHATBOT_ESTIMATED_ANALYSIS_KEY);
  clearAcknowledgedAnalysisHintId();
  notifyScanContextChanged();
}

/**
 * Reads the analysis session metadata from sessionStorage without parsing the
 * full result object.  Returns only the `source` and `imagePreviews` fields
 * that are needed by the hint-banner qualification checks.
 *
 * @returns A partial session object, or null if nothing is stored / parsing fails.
 */
function readAnalysisSessionMeta(): { source?: string; imagePreviews?: string[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ANALYSIS_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { source?: string; imagePreviews?: string[] };
  } catch {
    return null;
  }
}

/**
 * Returns true only when the current analysis session originated from a real
 * photo scan (either from the /recommendation page or from a chatbot photo
 * upload).  Typed-only food queries do NOT qualify because the "Your food
 * analysis is ready" banner would be confusing without an actual scanned image.
 *
 * Decision matrix:
 *   - source === "recommendation"                           → true (always photo-based)
 *   - source === "chatbot" AND imagePreviews.length > 0     → true (chatbot photo scan)
 *   - source === "chatbot" AND imagePreviews.length === 0   → false (typed-only)
 *   - no session / any other source                         → false
 */
/** Analysis hint only for Food Recognition (/recommendation) or chatbot photo/menu scan — not typed-only chat cards. */
function sessionQualifiesForAnalysisHintBanner(): boolean {
  const m = readAnalysisSessionMeta();
  if (!m) return false;
  if (m.source === "recommendation") return true;
  if (m.source === "chatbot" && (m.imagePreviews?.length ?? 0) > 0) return true;
  return false;
}

/**
 * Clears the scan context only when the current session was created by the
 * chatbot from typed food names (i.e., no images).  Returns true if a clear
 * was performed, false otherwise.
 *
 * The distinction matters because we don't want to blow away a photo-based
 * analysis that the user still has open on the recommendation page just
 * because they typed a new food query in the chatbot.
 */
/** Typed-food analysis saved for View Detailed Analysis — not menu photo scans. */
function clearChatbotTypedFoodScanContext(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sessionRaw = sessionStorage.getItem(ANALYSIS_SESSION_KEY);
    if (!sessionRaw) return false;
    const session = JSON.parse(sessionRaw) as {
      source?: string;
      imagePreviews?: string[];
    };
    if (session.source !== "chatbot") return false;
    if ((session.imagePreviews?.length ?? 0) > 0) return false;
    clearStoredScanContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true when the user's message is a short conversational acknowledgement
 * or correction that should NOT be treated as a food-related query.
 *
 * Examples: "ok", "thanks", "wrong", "never mind", "what do you mean"
 *
 * When this returns true, `sendMessage` clears the in-memory scan context
 * before building the API request so that stale food data from a previous
 * turn doesn't get forwarded and confuse the LLM.
 *
 * @param text - Raw text typed by the user.
 * @returns True for known conversational phrases, false otherwise.
 */
function isConversationalClientMessage(text: string): boolean {
  const n = text.trim().toLowerCase();
  const exact = new Set([
    "ok",
    "okay",
    "why",
    "no",
    "nope",
    "wrong",
    "thanks",
    "thank you",
    "try again",
    "not available",
    "not available though",
    "that is wrong",
    "thats wrong",
    "what do you mean",
    "never mind",
    "nevermind",
  ]);
  if (exact.has(n)) return true;
  return /^(not available|why though|ok but|but why|what do you mean)/i.test(n);
}

/**
 * Converts a File object to a base64-encoded data URL using the FileReader API.
 * Used to embed image previews in message state (so they survive across re-renders)
 * and to produce the data URL strings stored in the analysis session record.
 *
 * @param file - The File to read.
 * @returns A Promise that resolves with the data URL string, or rejects if the
 *          FileReader encounters an error.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Returns true when the given ScanContext contains at least one food item
 * in any of the four category buckets (Appetizer, Main Dish, Dessert, Drinks).
 * Used as a guard before displaying food-related UI elements.
 *
 * @param ctx - A ScanContext object, or null.
 * @returns True if any category has at least one ranked item.
 */
function hasScanContextItems(ctx: ScanContext | null): boolean {
  if (!ctx) return false;
  return (["Appetizer", "Main Dish", "Dessert", "Drinks"] as const).some(
    (category) => Boolean(ctx[category]?.ranking?.length)
  );
}

/**
 * Flattens all ranked food items from all four ScanContext categories into a
 * single array.  Returns an empty array when ctx is null.
 *
 * @param ctx - A ScanContext object, or null.
 * @returns A flat list of FoodItem objects from every category.
 */
function getScanFoodItems(ctx: ScanContext | null): FoodItem[] {
  if (!ctx) return [];
  return (["Appetizer", "Main Dish", "Dessert", "Drinks"] as const).flatMap(
    (category) => ctx[category]?.ranking ?? []
  );
}

/**
 * Extracts a deduplicated list of food names from the scan context.
 * Names are deduplicated by their lowercase-normalised form so that the
 * same food name appearing in two categories (e.g., a drink also classified
 * as a main) only appears once in the output.
 *
 * @param ctx - A ScanContext object, or null.
 * @returns A list of unique food name strings (original casing preserved).
 */
function getScanFoodNames(ctx: ScanContext | null): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of getScanFoodItems(ctx)) {
    const name = item.f?.trim();
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/**
 * Returns the ScanContext category key for a given food name, or undefined if
 * the food is not found in any category.  Useful for attaching the category
 * label to a ScanFoodSummary so the UI can group or annotate the food card.
 *
 * @param ctx      - The current ScanContext.
 * @param foodName - The exact food name to look up (case-sensitive).
 * @returns The matching category key, or undefined.
 */
function getFoodScanCategory(ctx: ScanContext, foodName: string): keyof Omit<ScanContext, "uniqueFoodCount"> | undefined {
  const categories = ["Main Dish", "Appetizer", "Dessert", "Drinks"] as const;
  return categories.find((cat) => ctx[cat]?.ranking?.some((item) => item.f === foodName));
}

/**
 * Converts a ScanContext category key to its localized display name.
 * Used in the photo-analysis summary message and in the best-choice reply.
 *
 * @param category - One of the four ScanContext category keys.
 * @param lang     - The target language.
 * @returns The localized category name string.
 */
function getLocalizedScanCategory(category: keyof Omit<ScanContext, "uniqueFoodCount">, lang: LangCode): string {
  const labels = {
    "Main Dish": { en: "Main Dish", ms: "Hidangan Utama", zh: "主食" },
    Appetizer: { en: "Appetizer", ms: "Pembuka Selera", zh: "前菜" },
    Dessert: { en: "Dessert", ms: "Pencuci Mulut", zh: "甜点" },
    Drinks: { en: "Drinks", ms: "Minuman", zh: "饮料" },
  } as const;
  return labels[category][lang];
}

/**
 * Returns a list of localized category names for all non-empty categories in
 * the scan context.  Used to build the "Food groups found:" summary line in
 * the photo-scan reply message.
 *
 * @param ctx  - A ScanContext object, or null.
 * @param lang - The target language.
 * @returns An array of localized category name strings.
 */
function getScanCategoryNames(ctx: ScanContext | null, lang: LangCode): string[] {
  if (!ctx) return [];
  return (["Main Dish", "Appetizer", "Dessert", "Drinks"] as const)
    .filter((category) => Boolean(ctx[category]?.ranking?.length))
    .map((category) => getLocalizedScanCategory(category, lang));
}

/**
 * Returns true when any food item in the scan context is high in fat (>7g),
 * sodium (>600mg), or has a "High" risk label.
 * Used to decide whether to append the high-nutrient warning line to the
 * photo-analysis summary message.
 *
 * @param ctx - A ScanContext object, or null.
 * @returns True if any item exceeds the nutrient thresholds.
 */
function hasHighFatOrSodium(ctx: ScanContext | null): boolean {
  return getScanFoodItems(ctx).some((item) => item.fat > 7 || item.salt > 600 || item.risk === "High");
}

/**
 * Returns true when the user's message text contains a phrase indicating they
 * want to know which food is the healthiest choice.  Supports English, Malay,
 * and Chinese phrasing.
 *
 * When this returns true for a photo-scan summary, the component also appends
 * the lowest-risk food name to the reply.
 *
 * @param text - The user's raw input text.
 * @returns True if a "healthier choice" intent is detected.
 */
function isHealthierComparisonRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return [
    "which one is healthier",
    "which is healthier",
    "healthier",
    "better choice",
    "best choice",
    "lebih sihat",
    "pilihan lebih baik",
    "更健康",
    "比较健康",
    "哪一个比较好",
  ].some((phrase) => normalized.includes(phrase));
}

/**
 * Finds and returns the food name with the lowest risk level in the scan
 * context.  Priority order: Low < Medium < High.
 *
 * Used in the photo-scan summary when the user asks for the healthiest choice,
 * and also in buildAutomaticBestChoiceSummary.
 *
 * @param ctx - A ScanContext object, or null.
 * @returns The food name string with the lowest risk, or null if no items exist.
 */
function getLowestRiskFoodName(ctx: ScanContext | null): string | null {
  const riskRank: Record<FoodItem["risk"], number> = { Low: 1, Medium: 2, High: 3 };
  const items = getScanFoodItems(ctx).filter((item) => item.f?.trim());
  if (!items.length) return null;
  return [...items].sort((a, b) => riskRank[a.risk] - riskRank[b.risk])[0]?.f ?? null;
}

/**
 * Detects whether a chatbot API reply is actually asking the user to select a
 * food category rather than providing a direct answer.
 *
 * The /api/chat backend can return a "which category?" prompt with quick-reply
 * chips when scan context contains multiple categories and the user's question
 * is ambiguous.  On the client side we intercept this reply and replace it with
 * a direct best-choice summary so the user doesn't have to click a chip.
 *
 * @param reply       - The assistant reply text from the API.
 * @param quickReplies - Quick reply chips accompanying the reply, if any.
 * @returns True when the reply looks like a manual category-selection prompt.
 */
function isManualCategoryPrompt(reply: string, quickReplies?: string[]): boolean {
  if (!quickReplies?.length) return false;
  const normalizedReply = reply.toLowerCase();
  return (
    normalizedReply.includes("which category") ||
    normalizedReply.includes("kategori") ||
    normalizedReply.includes("哪一类") ||
    normalizedReply.includes("类别")
  );
}

/**
 * Generates a short random string ID for a chat message.
 * Uses Math.random with base-36 encoding and slices 7 characters.
 * Not cryptographically secure, but unique enough for UI keying purposes.
 *
 * @returns A 7-character alphanumeric string.
 */
function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Reads the persisted chat message history from sessionStorage.
 * Returns null during SSR, when nothing is stored, or when parsing fails.
 * The stored value is a JSON-encoded Message[] array written by the component
 * in a useEffect whenever `messages` state changes.
 *
 * @returns The stored messages array, or null.
 */
function readMessageHistory(): Message[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Message[];
  } catch {
    return null;
  }
}

/**
 * Reads the user's gender preference from localStorage.
 * The preference is set on the Food page and persisted under the key
 * "manis-gender".  Defaults to "male" when not set.
 *
 * Gender is used by `buildDailyIntakeSummary` to compute the correct
 * daily recommended intake values (RDI) for sugar, sodium, and fat.
 *
 * @returns "female" or "male".
 */
function readGenderPreference(): Gender {
  if (typeof window === "undefined") return "male";
  return localStorage.getItem("manis-gender") === "female" ? "female" : "male";
}

/**
 * Normalizes a string to a stable lowercase key used to detect repeated
 * "food unavailable" requests.  Collapses whitespace and lowercases so that
 * "Nasi Lemak" and "nasi lemak" are treated as the same repeat key.
 *
 * @param value - The raw user input string.
 * @returns A normalized lowercase string with collapsed whitespace.
 */
function normalizeRepeatKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Returns the localized display name for a cart food item.
 * Falls back to the English name if the requested language key is empty.
 *
 * @param food - A CartFoodItem from the shared food database.
 * @param lang - The desired language code.
 * @returns The food name string in the requested language.
 */
function getCartFoodName(food: CartFoodItem, lang: LangCode): string {
  return food.name[lang] || food.name.en;
}

/**
 * Maps a LangCode to the BCP 47 language tag expected by the Web Speech API.
 * "ms" → "ms-MY" (Malay, Malaysia), "zh" → "zh-CN" (Simplified Chinese),
 * anything else → "en-US".
 *
 * @param lang - The app language code.
 * @returns A BCP 47 language tag string for SpeechRecognition.lang.
 */
function getSpeechRecognitionLanguage(lang: LangCode): string {
  if (lang === "ms") return "ms-MY";
  if (lang === "zh") return "zh-CN";
  return "en-US";
}

/**
 * Formats an elapsed recording time in seconds as "MM:SS".
 * Used in the voice-input status bar (e.g., "Recording... 00:42").
 *
 * @param seconds - Total elapsed seconds since recording started.
 * @returns A zero-padded "MM:SS" time string.
 */
function formatRecordingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

/**
 * Applies Unicode NFKC normalization, strips all non-letter/non-digit
 * characters, lowercases the result, and collapses whitespace.
 *
 * This shared normalizer is used across the language-detection markers,
 * meal-plan intent detection, and analysis-reset detection so that
 * punctuation and CJK width differences don't break keyword matching.
 *
 * @param value - Raw input string.
 * @returns Normalized lowercase string.
 */
function normalizeLanguageText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Heuristically detects the language the user typed.
 *
 * Detection order:
 *   1. If any CJK character (Unicode block U+3400–U+9FFF) is present → "zh"
 *   2. If Malay keyword markers are found but no English ones → "ms"
 *   3. If English keyword markers are found but no Malay ones → "en"
 *   4. Otherwise → null (caller falls back to the current conversation language)
 *
 * The marker lists intentionally focus on health/food vocabulary so that
 * short, ambiguous inputs (e.g. "ok", "add") don't flip the language.
 *
 * @param message - The raw user message.
 * @returns Detected LangCode or null.
 */
function detectUserMessageLanguage(message: string): LangCode | null {
  const normalized = normalizeLanguageText(message);
  if (!normalized) return null;
  if (/[\u3400-\u9fff]/u.test(message)) return "zh";

  const malayMarkers = [
    "apa", "adakah", "bagaimana", "boleh", "makanan", "pilih", "daripada",
    "diimbas", "tekanan darah", "tinggi", "gula darah", "pemakanan", "hadkan",
    "kurangkan", "saya", "hari ini", "tiga tinggi", "makan", "minum",
  ];
  const englishMarkers = [
    "what", "which", "how", "is this", "can i", "should i", "food", "choose",
    "scanned menu", "daily food plan", "today", "diabetes", "blood pressure",
    "high cholesterol", "three highs", "limit", "avoid", "suitable", "eat", "drink",
  ];

  const hasMalay = malayMarkers.some((marker) => normalized.includes(marker));
  const hasEnglish = englishMarkers.some((marker) => normalized.includes(marker));

  if (hasMalay && !hasEnglish) return "ms";
  if (hasEnglish && !hasMalay) return "en";
  return null;
}

/**
 * Returns the detected language for a user message, falling back to the
 * current conversation language if detection returns null.
 *
 * @param message  - The user's input text.
 * @param fallback - The current conversation language to use as fallback.
 * @returns A LangCode that will be used for this conversation turn.
 */
function getUserMessageLanguage(message: string, fallback: LangCode): LangCode {
  return detectUserMessageLanguage(message) ?? fallback;
}

/**
 * Matches a user message against the three starter question options shown in
 * the welcome message ("Check my food or menu", "Help me plan today's meals",
 * "Learn about diabetes, blood pressure & cholesterol") in all three languages.
 *
 * When matched, the component replies with a static guide message and optional
 * CTA button WITHOUT calling the LLM, keeping the response instant.
 *
 * @param message - The user's input text.
 * @returns The matched onboarding intent, or null if no match.
 */
type OnboardingIntent = "food-check" | "meal-plan" | "learn";

function getOnboardingIntent(message: string): OnboardingIntent | null {
  const normalized = message.trim().toLowerCase();
  const intentOrder: OnboardingIntent[] = ["food-check", "meal-plan", "learn"];
  for (const translations of Object.values(t)) {
    const index = translations.suggestedQ.findIndex((question) => question.toLowerCase() === normalized);
    if (index >= 0) return intentOrder[index] ?? null;
  }
  return null;
}

/**
 * Detects whether a user's message is a natural-language request to add or
 * remove a food from their meal plan (cart), without calling the LLM.
 *
 * The detection uses three signals:
 *   1. Explicit phrases like "add it", "帮我加进去", "buang ini" → immediate match
 *   2. Combination of a cart-target keyword ("cart", "pelan makanan", "购物车")
 *      AND an add/remove verb → match
 *
 * We intercept these on the client side so the cart action is executed
 * immediately and the reply is instant, rather than having to wait for the LLM
 * to generate a response (which would have no actual ability to modify the cart).
 *
 * @param message - The user's raw input text.
 * @returns "add", "remove", or null.
 */
function getMealPlanIntent(message: string): "add" | "remove" | null {
  const n = normalizeLanguageText(message);

  // Specific phrases that clearly mean add/remove even without a cart keyword
  const addPhrases = [
    "add it", "add this", "add that", "add food",
    "帮我加进去", "帮我加入", "加进去", "加入这个", "加入这", "帮我加",
    "tambahkan", "masukkan ini", "tambah ini",
  ];
  const removePhrases = [
    "remove it", "remove this", "remove that",
    "移除这个", "删掉这个", "删除这个",
    "buang ini", "keluarkan ini",
  ];

  // Cart/plan target words
  const cartTargets = ["cart", "meal plan", "pelan makanan", "pelan", "购物车", "饮食计划", "餐单"];
  const hasCartTarget = cartTargets.some((kw) => n.includes(normalizeLanguageText(kw)));

  // Verb groups
  const addVerbs = ["add", "tambah", "masukkan", "simpan", "加"];
  const removeVerbs = ["remove", "delete", "buang", "keluarkan", "移除", "删除"];
  const hasAddVerb = addVerbs.some((v) => n.includes(normalizeLanguageText(v)));
  const hasRemoveVerb = removeVerbs.some((v) => n.includes(normalizeLanguageText(v)));

  const hasAddPhrase = addPhrases.some((p) => n.includes(normalizeLanguageText(p)));
  const hasRemovePhrase = removePhrases.some((p) => n.includes(normalizeLanguageText(p)));

  if ((hasRemoveVerb && hasCartTarget) || hasRemovePhrase) return "remove";
  if ((hasAddVerb && hasCartTarget) || hasAddPhrase) return "add";
  return null;
}

/**
 * Returns true when the user's message appears to be a request to reset or
 * clear the current food analysis (scan context).
 *
 * The detection requires EITHER:
 *   a) A known standalone reset phrase (e.g., "reset analysis", "清除分析"), OR
 *   b) A reset verb (reset / clear / kosongkan / 重置) co-occurring with an
 *      analysis noun (analysis / scan / analisis / 扫描)
 *
 * When detected, the component clears sessionStorage, resets all in-memory
 * analysis refs, and dispatches ANALYSIS_RESET_EVENT — no LLM call needed.
 *
 * @param message - The user's raw input text.
 * @returns True if a reset intent is detected.
 */
function isAnalysisResetIntent(message: string): boolean {
  const n = normalizeLanguageText(message);
  // Reset/clear verbs
  const resetVerbs = ["reset", "clear", "start over", "restart", "delete all",
    "set semula", "kosongkan", "mula semula", "padam semua",
    "重置", "清除", "重新", "清空", "重来",
  ];
  // Analysis nouns — must co-occur with a verb OR be a standalone reset phrase
  const analysisNouns = ["analysis", "analyze", "analyse", "scanned food", "scan result", "scan",
    "analisis", "pengimbasan", "imbasan",
    "分析", "扫描结果", "扫描",
  ];
  // Standalone phrases that unambiguously mean reset analysis
  const standalonePhrases = [
    "reset analysis", "reset the analysis", "reset the analyze", "clear analysis",
    "clear scanned food", "start over analysis", "clear my scan",
    "set semula analisis", "kosongkan analisis", "mula semula analisis",
    "重置分析", "清除分析", "重新分析", "清除扫描结果", "重来一次",
  ];
  if (standalonePhrases.some((p) => n.includes(normalizeLanguageText(p)))) return true;
  const hasResetVerb = resetVerbs.some((v) => n.includes(normalizeLanguageText(v)));
  const hasAnalysisNoun = analysisNouns.some((noun) => n.includes(normalizeLanguageText(noun)));
  return hasResetVerb && hasAnalysisNoun;
}

/**
 * Custom event dispatched when the user requests an analysis reset via the
 * chatbot.  The recommendation page listens for this event to clear its own
 * UI state without requiring a page reload.
 */
const ANALYSIS_RESET_EVENT = "sihat-analysis-reset";

/**
 * Represents the "most recent food the chatbot has given advice about".
 * Used by the client-side cart command handler to know which food to
 * add/remove when the user says "add it" or "remove this".
 *
 *   - "available"   → a DB-matched food was found; `food` carries the CartFoodItem.
 *   - "unavailable" → the food was mentioned but not in the database; `name` is the
 *                     food name string from the last assistant message.
 *   - "none"        → no food context exists in the recent message history.
 */
type FoodContext =
  | { status: "available"; food: CartFoodItem }
  | { status: "unavailable"; name: string }
  | { status: "none" };

/**
 * Walks the message array backwards to find the most recent food context
 * from an assistant message.  Returns the first match found.
 *
 * This is used by the meal-plan intent handler to figure out WHICH food the
 * user is referring to when they say "add it" or "remove this" — it's always
 * the most recently discussed food in the conversation.
 *
 * @param messages - The full message array.
 * @returns A FoodContext describing the latest food, or `{ status: "none" }`.
 */
function getLatestFoodContext(messages: Message[]): FoodContext {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    if (msg.suggestions?.length) return { status: "available", food: msg.suggestions[0] };
    if (msg.unavailableFoodName) return { status: "unavailable", name: msg.unavailableFoodName };
  }
  return { status: "none" };
}

/**
 * Renders a chat message's text content as a list of React fragments.
 *
 * Most lines are rendered as plain text separated by `<br />` elements.
 * Lines that start with the sentinel prefix "!HIGH_NUTRITION! " are rendered
 * as styled warning badges (red background, bold text) so users immediately
 * notice high-risk nutrient warnings in a food analysis reply.
 *
 * @param content - The raw message content string, possibly multi-line.
 * @returns An array of React fragments (text + optional br / warning span).
 */
function renderMessageContent(content: string) {
  return content.split("\n").map((line, index, lines) => {
    const lineBreak = index < lines.length - 1 ? <br /> : null;
    const warningPrefix = "!HIGH_NUTRITION! ";

    if (!line.startsWith(warningPrefix)) {
      return (
        <Fragment key={`${line}-${index}`}>
          {line}
          {lineBreak}
        </Fragment>
      );
    }

    const warningText = line.slice(warningPrefix.length);

    return (
      <Fragment key={`${line}-${index}`}>
        <span
          className="my-1 inline-flex items-center rounded-xl border px-3 py-1.5 font-bold"
          style={{ background: "#fee2e2", borderColor: "#dc2626", color: "#991b1b" }}
        >
          {warningText}
        </span>
        {lineBreak}
      </Fragment>
    );
  });
}

// ─── FOOD SUMMARY (text-only) ─────────────────────────────────────────────────

/**
 * Maps an internal risk key ("low" / "medium" / "high") to the localized
 * display label in the given language.
 *
 * @param risk - The lowercase risk level key.
 * @param lang - The target language.
 * @returns The translated risk label string.
 */
function localizedRiskFromKey(risk: "low" | "medium" | "high", lang: LangCode): string {
  return {
    low:    { en: "Low Risk",    ms: "Risiko Rendah",    zh: "低风险"   },
    medium: { en: "Medium Risk", ms: "Risiko Sederhana", zh: "中等风险" },
    high:   { en: "High Risk",   ms: "Risiko Tinggi",    zh: "高风险"   },
  }[risk][lang];
}

/**
 * Formats a food name for display in the chat card.
 * - For Chinese text or text containing Han characters, the name is returned
 *   as-is (Title Case would mangle CJK characters).
 * - For Latin-script names (English / Malay), each word is title-cased so
 *   "nasi lemak" becomes "Nasi Lemak".
 *
 * Note: DB-matched food names already use canonical casing from the database;
 * this function is mainly needed for AI-estimated names that may be all-lowercase.
 *
 * @param name - Raw food name string.
 * @param lang - The current language (used to detect CJK context).
 * @returns The formatted display name.
 */
/** Title Case for AI-estimated names; DB names already use canonical casing. */
function formatFoodDisplayName(name: string, lang: LangCode): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (lang === "zh" || /\p{Script=Han}/u.test(trimmed)) return trimmed;
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns the localized "Health tip" header text used above the tip section
 * in all food card types.
 *
 * @param lang - The current language.
 * @returns The header string ("健康提示", "Tip Kesihatan", or "Health tip").
 */
function foodCardTipHeader(lang: LangCode): string {
  return lang === "zh" ? "健康提示" : lang === "ms" ? "Tip Kesihatan" : "Health tip";
}

/**
 * Shared layout component for all food card types (DB match, scan, AI estimated).
 * Renders the food display name, risk label, and health tip in a consistent
 * typographic style optimised for elderly users (large font, generous line height).
 *
 * An optional `footer` node is rendered below the tip — used by `AiFoodCard`
 * to inject the "AI-generated analysis" disclaimer badge.
 */
/** Shared typography for database + AI-estimated food cards (matches single DB card). */
function FoodCardBody({
  displayName,
  riskLabel,
  tip,
  lang,
  footer,
}: {
  displayName: string;
  riskLabel: string;
  tip: string;
  lang: LangCode;
  footer?: ReactNode;
}) {
  const tipHeader = foodCardTipHeader(lang);
  return (
    <div
      className="text-gray-800"
      style={{ whiteSpace: "normal", fontSize: "18px", lineHeight: "1.7" }}
    >
      <p className="font-bold mb-1" style={{ fontSize: "20px" }}>
        {displayName}
      </p>
      <p className="mb-2" style={{ fontSize: "17px", lineHeight: "1.65" }}>
        {riskLabel}
      </p>
      {tip ? (
        <>
          <p className="font-semibold mb-1" style={{ fontSize: "17px", lineHeight: "1.65" }}>
            {tipHeader}
            {lang === "zh" ? "：" : ":"}
          </p>
          <p style={{ fontSize: "17px", lineHeight: "1.65" }}>{tip}</p>
        </>
      ) : null}
      {footer}
    </div>
  );
}

/**
 * Converts a FoodItem (from a scan-context ranking array) into the
 * ScanFoodSummary shape used by the in-chat food card renderer.
 *
 * Handles the dual tip format: plain string (legacy) vs. multilingual object.
 * Also attaches the category label from the scan context so the card can show
 * which meal bucket the food belongs to.
 *
 * @param item       - A FoodItem from the scan context ranking array.
 * @param ctx        - The full ScanContext (used to look up the category).
 * @param messageLang - The language for resolving the multilingual tip.
 * @returns A ScanFoodSummary ready for the FoodScanSummary component.
 */
function foodItemToScanSummary(item: FoodItem, ctx: ScanContext, messageLang: LangCode): ScanFoodSummary {
  const tip =
    typeof item.tip === "object" && item.tip
      ? (item.tip[messageLang] || item.tip.en || "")
      : (item.tip ?? "");
  return {
    name: item.f,
    risk: item.risk,
    tip,
    category: getFoodScanCategory(ctx, item.f),
    sugarG: item.sugar,
    sodiumMg: item.salt,
    fatG: item.fat,
  };
}

/**
 * Renders a food card for a single item from a photo/menu scan result.
 * Recomputes the risk level from raw nutrient values (sugar/sodium/fat) so
 * the displayed level is always consistent with `computeRiskFromIndicators`.
 */
function FoodScanSummary({ scanFood, lang }: { scanFood: ScanFoodSummary; lang: LangCode }) {
  const rk = computeRiskFromIndicators(scanFood.sugarG, scanFood.sodiumMg, scanFood.fatG, scanFood.risk);
  const riskLabel = localizedRiskFromKey(rk, lang);
  return (
    <FoodCardBody
      displayName={scanFood.name}
      riskLabel={riskLabel}
      tip={scanFood.tip}
      lang={lang}
    />
  );
}

/**
 * Decides which food card variant to render for a single-food assistant message.
 * Priority:
 *   1. If `scanFood` is present → render FoodScanSummary (photo scan result)
 *   2. If `food` is present → render DB food card (from CartFoodItem)
 *   3. Otherwise → fall back to plain renderMessageContent (text only)
 */
function FoodSummaryCard({ content, food, scanFood, lang }: {
  content: string;
  food?: CartFoodItem;
  scanFood?: ScanFoodSummary;
  lang: LangCode;
}) {
  if (scanFood) {
    return <FoodScanSummary scanFood={scanFood} lang={lang} />;
  }

  if (food) {
    const foodName = getCartFoodName(food, lang);
    const sugarN = parseNutrientNumber(food.sugar);
    const sodiumN = parseNutrientNumber(food.sodium);
    const fatN = parseNutrientNumber(food.fat);
    const rk = computeRiskFromIndicators(sugarN, sodiumN, fatN, food.risk);
    const riskLabel = localizedRiskFromKey(rk, lang);
    const tip = food.tip[lang] || food.tip.en || "";

    return (
      <FoodCardBody
        displayName={foodName}
        riskLabel={riskLabel}
        tip={tip}
        lang={lang}
      />
    );
  }

  return <>{renderMessageContent(content)}</>;
}

/**
 * Compact structured summary card for a single DB-matched food in a multi-food
 * response (isMultiFood === true).  Used when the user asks about several foods
 * at once and the API returns a `suggestions` array with multiple items.
 */
// Compact structured summary for each food in a multi-food typed response.
function FoodItemCard({ food, lang }: { food: CartFoodItem; lang: LangCode }) {
  const foodName = getCartFoodName(food, lang);
  const tip = food.tip[lang] || food.tip.en || "";
  const sugarN = parseNutrientNumber(food.sugar);
  const sodiumN = parseNutrientNumber(food.sodium);
  const fatN = parseNutrientNumber(food.fat);
  const rk = computeRiskFromIndicators(sugarN, sodiumN, fatN, food.risk);
  const riskLabel = localizedRiskFromKey(rk, lang);

  return (
    <FoodCardBody
      displayName={foodName}
      riskLabel={riskLabel}
      tip={tip}
      lang={lang}
    />
  );
}

/**
 * Food card for a single AI-estimated food (not in the SIHAT database).
 * Shows the risk label from `computeRiskFromIndicators` when all three
 * nutrient values are present; otherwise falls back to the raw risk key
 * returned by the LLM.
 *
 * Always appends an "AI-generated analysis" label and disclaimer footer
 * so users understand the information may be less accurate than DB data.
 */
function AiFoodCard({ food, lang }: { food: EstimatedFoodCard; lang: LangCode }) {
  const sugarN = food.sugar ?? Number.NaN;
  const sodiumN = food.sodium ?? Number.NaN;
  const fatN = food.fat ?? Number.NaN;
  const hasAllNums = Number.isFinite(sugarN) && Number.isFinite(sodiumN) && Number.isFinite(fatN);
  const rk = hasAllNums ? computeRiskFromIndicators(sugarN, sodiumN, fatN, food.risk) : food.risk;
  const riskLabel = localizedRiskFromKey(rk, lang);
  const noDbLabel      = { en: "AI-generated food analysis", ms: "Analisis makanan jana AI", zh: "AI生成的食物分析" }[lang];
  const noDbDisclaimer = {
    en: "This food is not currently in the SIHAT food database. The nutrition information and health advice shown here are estimated by AI and may not be fully accurate.",
    ms: "Makanan ini tidak terdapat dalam pangkalan data makanan SIHAT. Maklumat pemakanan dan nasihat kesihatan yang ditunjukkan di sini dianggarkan oleh AI dan mungkin tidak sepenuhnya tepat.",
    zh: "此食物目前不在SIHAT食物数据库中。此处显示的营养信息和健康建议由AI估算，可能并不完全准确。",
  }[lang];

  return (
    <FoodCardBody
      displayName={formatFoodDisplayName(food.name, lang)}
      riskLabel={riskLabel}
      tip={food.tip ?? ""}
      lang={lang}
      footer={
        <>
          <p className="mt-2 font-semibold text-gray-500" style={{ fontSize: "12px" }}>
            {noDbLabel}
          </p>
          <p className="mt-1 text-gray-400" style={{ fontSize: "12px" }}>
            {noDbDisclaimer}
          </p>
        </>
      }
    />
  );
}

/**
 * Maps an `EstimatedFoodCategory` (from AI-estimated cards) to the
 * corresponding ScanContext bucket key.
 *
 * "Drink" → "Drinks" (note the plural), everything else maps directly.
 * If category is null (unknown), defaults to "Main Dish".
 *
 * @param category - The EstimatedFoodCategory from the AI card.
 * @returns The ScanContext bucket key to use when storing this food.
 */
function scanBucketForEstimatedCategory(
  category: EstimatedFoodCategory | null
): keyof Omit<ScanContext, "uniqueFoodCount"> {
  if (category === "Drink") return "Drinks";
  if (category === "Appetizer") return "Appetizer";
  if (category === "Dessert") return "Dessert";
  return "Main Dish";
}

/**
 * Converts a CartFoodItem (from the SIHAT food database) into a FoodItem that
 * can be stored inside a ScanContext ranking array.
 *
 * This is needed when the user clicks "View Detailed Analysis" after the chatbot
 * provides a DB food card — we need to rebuild a ScanContext-shaped object so
 * the recommendation page can render the full detailed analysis without re-calling
 * /api/predict.
 *
 * @param food   - The CartFoodItem to convert.
 * @param uiLang - The language used to resolve the food's display name.
 * @returns A FoodItem suitable for inclusion in a ScanContext ranking array.
 */
function cartFoodToScanItem(food: CartFoodItem, uiLang: LangCode): FoodItem {
  const sugarN = parseNutrientNumber(food.sugar);
  const sodiumN = parseNutrientNumber(food.sodium);
  const fatN = parseNutrientNumber(food.fat);
  const rk = computeRiskFromIndicators(sugarN, sodiumN, fatN, food.risk);
  const risk: FoodItem["risk"] = rk === "high" ? "High" : rk === "low" ? "Low" : "Medium";
  return {
    f: getCartFoodName(food, uiLang),
    sugar: sugarN,
    salt: sodiumN,
    fat: fatN,
    risk,
    tip: { en: food.tip.en, ms: food.tip.ms, zh: food.tip.zh },
    db_matched: true,
  };
}

/**
 * Converts an AI-estimated food card into the FoodItem shape expected by
 * ScanContext ranking arrays.  Missing nutrient values default to 0.
 * The tip is stored as a trilingual object with the same string for all three
 * languages (since the LLM returned a single tip without language variants).
 *
 * @param card - The EstimatedFoodCard returned by /api/chat.
 * @returns A FoodItem suitable for inclusion in a ScanContext ranking array.
 */
function estimatedCardToScanItem(card: EstimatedFoodCard): FoodItem {
  const sugar = card.sugar ?? 0;
  const sodium = card.sodium ?? 0;
  const fat = card.fat ?? 0;
  const rk = computeRiskFromIndicators(sugar, sodium, fat, card.risk);
  const risk: FoodItem["risk"] = rk === "high" ? "High" : rk === "low" ? "Low" : "Medium";
  const tip = card.tip ?? "";
  return {
    f: card.name,
    sugar,
    salt: sodium,
    fat,
    risk,
    tip: { en: tip, ms: tip, zh: tip },
    db_matched: false,
  };
}

/**
 * Reconstructs a /api/predict-shaped ScanContext from the food cards present
 * in a single chatbot message.  This allows "View Detailed Analysis" to work
 * for foods that were looked up via the chatbot without a full re-analysis.
 *
 * The function handles both DB-matched foods (`msg.suggestions`) and
 * AI-estimated cards (`msg.estimatedFood` / `msg.estimatedFoods`), placing
 * them into the correct ScanContext category buckets.
 *
 * Returns null when the message contains no food payload.
 *
 * @param msg     - The assistant message that contains food card data.
 * @param uiLang  - The language used to resolve food display names.
 * @returns A ScanContext ready to be saved to sessionStorage, or null.
 */
/** Build /api/predict-shaped scan context from chatbot DB + AI-estimated cards (no re-analysis). */
function buildScanContextFromChatbotMessage(msg: Message, uiLang: LangCode): ScanContext | null {
  const ctx: ScanContext = { uniqueFoodCount: 0 };

  const push = (bucket: keyof Omit<ScanContext, "uniqueFoodCount">, item: FoodItem) => {
    if (!ctx[bucket]) ctx[bucket] = { ranking: [] };
    ctx[bucket]!.ranking!.push(item);
    ctx.uniqueFoodCount = (ctx.uniqueFoodCount ?? 0) + 1;
  };

  for (const food of msg.suggestions ?? []) {
    push("Main Dish", cartFoodToScanItem(food, uiLang));
  }

  for (const card of msg.estimatedFood ? [msg.estimatedFood] : msg.estimatedFoods ?? []) {
    push(scanBucketForEstimatedCategory(card.category), estimatedCardToScanItem(card));
  }

  return ctx.uniqueFoodCount ? ctx : null;
}

/**
 * Builds a comma-separated string of food names from a chatbot message for
 * display as the user-text label in the analysis session record.
 * This string is shown on the recommendation page as "Analysed: Nasi Lemak, Teh Tarik".
 *
 * @param msg     - The assistant message containing food card data.
 * @param uiLang  - The language used to resolve display names.
 * @returns A comma-separated food name string (may be empty).
 */
function buildRecTextFromMessage(msg: Message, uiLang: LangCode): string {
  const names = [
    ...(msg.suggestions ?? []).map((f) => getCartFoodName(f, uiLang)),
    ...(msg.estimatedFood ? [msg.estimatedFood.name] : (msg.estimatedFoods ?? []).map((f) => f.name)),
  ];
  return names.filter(Boolean).join(", ");
}

/**
 * Prepares the sessionStorage scan context so the recommendation page can
 * render the full detailed analysis instantly (without calling /api/predict)
 * when the user clicks "View Detailed Analysis".
 *
 * Steps:
 *   1. Rebuilds a ScanContext from the chatbot message's food cards
 *   2. Writes it to sessionStorage via saveScanContext()
 *   3. Stores the comma-separated food names in "rec-text" for the page subtitle
 *
 * Returns true when the context was successfully written (caller should update
 * the scanContext state so the action button guard doesn't block navigation).
 * Returns false when the message contains no food payload (no navigation).
 *
 * @param msg     - The assistant message whose food cards to use.
 * @param uiLang  - The language for resolving food display names.
 * @returns True when scan context was written successfully.
 */
function prepareRecommendationNavigationForMessage(msg: Message, uiLang: LangCode): boolean {
  const scanCtx = buildScanContextFromChatbotMessage(msg, uiLang);
  if (!scanCtx) {
    sessionStorage.removeItem(CHATBOT_ESTIMATED_ANALYSIS_KEY);
    return false;
  }

  sessionStorage.removeItem(CHATBOT_ESTIMATED_ANALYSIS_KEY);
  const recLine = buildRecTextFromMessage(msg, uiLang);
  saveScanContext(
    JSON.stringify(scanCtx),
    {
      userText: recLine,
      selectedCategory: getFirstAnalysisCategory(scanCtx),
    }
  );
  if (recLine) sessionStorage.setItem("rec-text", recLine);
  console.log("[Chatbot] Saved scan context for instant detailed analysis:", recLine);
  return true;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

/**
 * The main AIChatbot component.
 *
 * Renders a fixed floating button at the bottom-right of every page.  When the
 * user taps it, a chat panel slides up with the full conversation interface.
 *
 * Props:
 *   - `lang` — the current page UI language (en / ms / zh).  This can differ
 *     from `conversationLang`, which tracks the language the user is actually
 *     typing in during a conversation turn.
 *
 * State management overview:
 *   - `messages`           — the full in-memory conversation array (also persisted to sessionStorage).
 *   - `conversationLang`   — the language of the current active conversation turn.
 *   - `scanContext`        — in-memory copy of the food scan result (mirrors sessionStorage).
 *   - `hasActiveFoodContext` — sticky boolean; stays true while any food context has been set
 *                             in this session (drives the "Food Detected" badge in the header).
 *   - `pendingImages`      — images staged for upload but not yet sent.
 *   - Various UI state     — isOpen, isLoading, isListening, voiceNotice, mealPlanToast, etc.
 */
export function AIChatbot({ lang }: { lang: LangCode }) {
  const tx = t[lang] ?? t["en"];
  // Tracks the language the conversation is actually happening in (may differ
  // from the page lang when user types in another language).
  // Example: page is in English but user types Malay → conversationLang becomes "ms"
  // for that turn.  The page lang override useEffect will re-align them if the
  // user switches the page language while still in an initial seed chat state.
  const [conversationLang, setConversationLang] = useState<LangCode>(lang);
  const ctx = t[conversationLang] ?? t["en"];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);            // waiting for /api/chat response
  const [isPhotoAnalyzing, setIsPhotoAnalyzing] = useState(false); // waiting for /api/predict response
  const [scanContext, setScanContext] = useState<ScanContext | null>(null);
  // Sticky flag: true whenever a valid food/menu context has been established.
  // Only cleared by explicit user actions (Clear chat / Reset analysis / recommendation reset).
  // Normal chat turns do NOT clear this — the badge must persist while food context exists.
  const [hasActiveFoodContext, setHasActiveFoodContext] = useState<boolean>(
    () => typeof window !== "undefined" && hasScanContextItems(readScanContext())
  );
  const [hasInitialised, setHasInitialised] = useState(false);  // true after first open
  const [supportsVoiceInput, setSupportsVoiceInput] = useState(false);   // Web Speech API available
  const [supportsImageUpload, setSupportsImageUpload] = useState(false);  // FormData/File/FileReader available
  const [isListening, setIsListening] = useState(false);         // microphone actively recording
  const [recordingSeconds, setRecordingSeconds] = useState(0);   // elapsed recording time counter
  const [messageImagePreviews, setMessageImagePreviews] = useState<Record<string, string[]>>({});
  // Map from message ID to array of object-URL strings for user messages with photo uploads
  const [pendingImages, setPendingImages] = useState<PendingChatImage[]>([]); // staged for upload
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null); // enlarged image modal
  const [voiceNotice, setVoiceNotice] = useState("");    // status/error notice below the input bar
  const [mealPlanToast, setMealPlanToast] = useState(""); // transient toast for cart add/remove
  const [isFoodDetailModalOpen, setIsFoodDetailModalOpen] = useState(false); // hides floating button
  const [isDesktop, setIsDesktop] = useState(false);     // drives textarea min-height / placeholder
  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useCart();

  const pathname = usePathname();
  const router = useRouter();
  const lastRequestedLangRef = useRef<LangCode>(lang);          // last page-level lang that was acknowledged
  const conversationLangRef = useRef<LangCode>(lang);           // ref mirror of conversationLang (for stable callbacks)
  const lastUnavailableRequestRef = useRef<string | null>(null); // dedupes "food not available" retries
  const messagesEndRef = useRef<HTMLDivElement>(null);           // scroll sentinel at the bottom of the list
  const messagesScrollRef = useRef<HTMLDivElement>(null);        // the scrollable messages container
  const inputRef = useRef<HTMLTextAreaElement>(null);            // the textarea for user input
  const imageInputRef = useRef<HTMLInputElement>(null);          // hidden file input for photo uploads
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null); // active SpeechRecognition instance
  const chatAbortRef = useRef<AbortController | null>(null);    // lets stopResponding() cancel the fetch
  const isSendingRef = useRef(false);                            // synchronous in-flight lock to prevent double-send races
  const imagePreviewUrlsRef = useRef<Set<string>>(new Set());   // tracks object URLs for revocation on unmount
  const pendingVoiceTranscriptRef = useRef("");                  // accumulates voice transcript during recording
  const lastScanContextRawRef = useRef<string | null>(null);
  // Last analysis id we processed for the scan/menu hint (dedupes events, session flush, and welcome).
  const lastHandledAnalysisHintIdRef = useRef<string | null>(null);
  // Set when analysis completes while chatbot is closed; consumed on open.
  const pendingAnalysisHintIdRef = useRef<string | null>(null);
  // Ref mirrors of volatile state so stable callbacks can read current values.
  const isOpenRef = useRef(false);
  const txRef = useRef<typeof tx>(tx);
  // Mirrors ctx (t[conversationLang]) so async callbacks always read the active
  // conversation language even when the page UI language differs.
  const conversationTxRef = useRef<typeof ctx>(ctx);
  const messagesRef = useRef<Message[]>([]);
  const pendingImagesRef = useRef<PendingChatImage[]>([]);

  const revokeImagePreview = useCallback((url: string) => {
    // Revoke an object URL to free memory and remove it from the tracking set.
    // Called when a pending image is removed before sending, or on component unmount.
    URL.revokeObjectURL(url);
    imagePreviewUrlsRef.current.delete(url);
  }, []);

  // Scroll the message container to the bottom.
  // Tries container.scrollTo first, then falls back to the sentinel scrollIntoView.
  // Mobile Safari often needs a second layout pass before scrollHeight is final,
  // so callers may schedule multiple delayed invocations.
  const scrollChatToBottom = useCallback((smooth = true) => {
    const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
    const container = messagesScrollRef.current;
    if (container) {
      try {
        container.scrollTo({ top: container.scrollHeight, behavior });
      } catch {
        container.scrollTop = container.scrollHeight;
      }
    }
    // Sentinel fallback: always fires so older Safari is covered.
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Keep volatile-state mirrors up to date so stable callbacks can read them.
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { txRef.current = tx; }, [tx]);
  useEffect(() => { conversationTxRef.current = ctx; }, [ctx]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  const hasUserMessage = useMemo(() => messages.some((m) => m.role === "user"), [messages]);

  // Track whether the panel was open on the previous render so we can tell
  // "just opened" from "new message while already open".
  const prevIsOpenRef = useRef(false);

  // Instant scroll when the chatbot panel opens (synchronous, pre-paint).
  useLayoutEffect(() => {
    if (!isOpen || messages.length === 0) return;
    const container = messagesScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [isOpen]);

  // Combined scroll effect: instant on open, smooth for new messages while open.
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }
    const justOpened = !prevIsOpenRef.current;
    prevIsOpenRef.current = true;
    if (justOpened) {
      // Extra delayed passes cover mobile reflow after panel height settles.
      scrollChatToBottom(false);
      const t1 = setTimeout(() => scrollChatToBottom(false), 0);
      const t2 = setTimeout(() => scrollChatToBottom(false), 120);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    scrollChatToBottom(true);
    const t = setTimeout(() => scrollChatToBottom(true), 100);
    return () => clearTimeout(t);
  }, [messages.length, isOpen, scrollChatToBottom]);

  /**
   * Appends the "I can see your food analysis is ready" hint once per unique
   * analysis ID to avoid showing the same hint multiple times.
   *
   * Deduplication logic:
   *   1. If analysisId matches the last-handled ID → skip (already shown).
   *   2. If analysisId matches the stored acknowledged ID in sessionStorage
   *      → mark as handled without showing (user already saw it before reload).
   *   3. Otherwise → mark as acknowledged, append the hint message, and scroll.
   *
   * The ref `lastHandledAnalysisHintIdRef` is updated in all cases so
   * subsequent calls with the same ID are no-ops.
   */
  const appendScanHintIfNew = useCallback((analysisId: string) => {
    if (!analysisId || analysisId === lastHandledAnalysisHintIdRef.current) return;
    const storedAck = readAcknowledgedAnalysisHintId();
    if (analysisId === storedAck) {
      lastHandledAnalysisHintIdRef.current = analysisId;
      pendingAnalysisHintIdRef.current = null;
      return;
    }
    lastHandledAnalysisHintIdRef.current = analysisId;
    markAnalysisHintAcknowledged(analysisId);
    pendingAnalysisHintIdRef.current = null;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: conversationTxRef.current.scanFound, id: uid() },
    ]);
    setTimeout(() => scrollChatToBottom(true), 100);
  }, [scrollChatToBottom]);

  // Close chatbot on route change while preserving session history
  useEffect(() => {
    if (!isOpen) return;
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleFoodDetailModal = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      const open = Boolean(detail?.open);
      setIsFoodDetailModalOpen(open);
      if (open) setIsOpen(false);
    };

    window.addEventListener("sihat_food_detail_modal", handleFoodDetailModal);
    return () => window.removeEventListener("sihat_food_detail_modal", handleFoodDetailModal);
  }, []);

  // Restore chat history for the current browser session
  useEffect(() => {
    const storedAck = readAcknowledgedAnalysisHintId();
    if (storedAck) lastHandledAnalysisHintIdRef.current = storedAck;

    const storedMessages = readMessageHistory();
    if (storedMessages?.length) {
      setMessages(storedMessages);
      setHasInitialised(true);
    }
  }, []);

  const lastPersistedMessagesRef = useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const serialised = JSON.stringify(messages);
    if (serialised === lastPersistedMessagesRef.current) return;
    lastPersistedMessagesRef.current = serialised;
    sessionStorage.setItem(STORAGE_KEY, serialised);
  }, [messages]);

  useEffect(() => {
    if (!isListening) {
      setRecordingSeconds(0);
      return;
    }

    const timerId = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isListening]);

  useEffect(() => {
    if (!previewImageUrl) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewImageUrl(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImageUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    setSupportsVoiceInput(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    setSupportsImageUpload(Boolean(window.FormData && window.File && window.FileReader));

    const checkDesktop = () => setIsDesktop(window.innerWidth >= 640);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      imagePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      imagePreviewUrlsRef.current.clear();
      window.removeEventListener("resize", checkDesktop);
    };
  }, []);

  // Initialise chatbot when first opened
  useEffect(() => {
    if (isOpen && !hasInitialised) {
      const ctx = readScanContext();
      setScanContext(ctx);

      const welcomeMsg: Message = {
        role: "assistant",
        content: tx.welcome,
        starterQuestions: tx.suggestedQ,
        id: uid(),
      };

      setMessages([welcomeMsg]);
      setHasInitialised(true);
      conversationLangRef.current = lang;
      setConversationLang(lang);
      lastRequestedLangRef.current = lang;

      // Focus input after open animation
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, hasInitialised, tx]);

  // Re-read scan context when chat opens; flush pending event or session-based hint (single deduped path).
  useEffect(() => {
    if (!isOpen) return;
    const raw = typeof window === "undefined" ? null : sessionStorage.getItem(SCAN_CONTEXT_KEY);
    const ctx = readScanContext();
    setScanContext(ctx);
    if (hasScanContextItems(ctx)) setHasActiveFoodContext(true);
    lastScanContextRawRef.current = raw;

    const pending = pendingAnalysisHintIdRef.current;
    if (pending) {
      appendScanHintIfNew(pending);
      return;
    }
    const analysisId = readAnalysisIdFromSession();
    if (analysisId && sessionQualifiesForAnalysisHintBanner()) {
      appendScanHintIfNew(analysisId);
    }
  }, [isOpen, appendScanHintIfNew]);

  // Analysis completed or opened elsewhere → append hint (deduped by analysis id).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAnalysisReady = (event: Event) => {
      const detail = (event as CustomEvent<AnalysisReadyDetail>).detail;
      const analysisId = detail?.analysisId;
      const src = detail?.source;
      if (!analysisId || !src || !ANALYSIS_HINT_EVENT_SOURCES.has(src)) return;
      if (analysisId === lastHandledAnalysisHintIdRef.current) return;

      const raw = sessionStorage.getItem(SCAN_CONTEXT_KEY);
      lastScanContextRawRef.current = raw;
      const ctx = readScanContext();
      setScanContext(ctx);
      if (hasScanContextItems(ctx)) setHasActiveFoodContext(true);

      if (isOpenRef.current) {
        appendScanHintIfNew(analysisId);
      } else {
        pendingAnalysisHintIdRef.current = analysisId;
      }
    };

    window.addEventListener(ANALYSIS_READY_EVENT, handleAnalysisReady);
    return () => window.removeEventListener(ANALYSIS_READY_EVENT, handleAnalysisReady);
  }, [appendScanHintIfNew]);

  // Keep chatbot scan context state in sync with session storage.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncScanContext = () => {
      const raw = sessionStorage.getItem(SCAN_CONTEXT_KEY);
      if (raw === lastScanContextRawRef.current) return;
      lastScanContextRawRef.current = raw;
      const ctx = readScanContext();
      setScanContext(ctx);
      if (hasScanContextItems(ctx)) setHasActiveFoodContext(true);
      if (!raw) pendingAnalysisHintIdRef.current = null;
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SCAN_CONTEXT_KEY) syncScanContext();
    };

    const resetLabels = [
      "reset", "delete all", "upload new photo",
      "set semula", "padam semua", "muat naik foto baru",
      "重置", "删除全部", "上传新照片",
    ];

    const handleRecommendationResetClick = (event: MouseEvent) => {
      if (!pathname.startsWith("/recommendation")) return;
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      const label = target?.textContent?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
      if (!label || !resetLabels.some((resetLabel) => label.includes(resetLabel))) return;
      clearStoredScanContext();
      lastScanContextRawRef.current = null;
      lastHandledAnalysisHintIdRef.current = null;
      pendingAnalysisHintIdRef.current = null;
      setScanContext(null);
      setHasActiveFoodContext(false);
    };

    syncScanContext();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(SCAN_CONTEXT_EVENT, syncScanContext);
    document.addEventListener("click", handleRecommendationResetClick, true);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(SCAN_CONTEXT_EVENT, syncScanContext);
      document.removeEventListener("click", handleRecommendationResetClick, true);
    };
  }, [pathname]);

  // ─── SEND MESSAGE ───────────────────────────────────────────────────────────

  /**
   * Toggles a food between "in meal plan" and "not in meal plan" when the user
   * clicks the add/remove button on a food card in the chat bubble.
   *
   * If the food is already in the cart → remove it and show a brief toast.
   * If not yet in the cart → add it (no toast; the button itself changes to a
   * green check-mark as feedback).
   *
   * Also clears `lastUnavailableRequestRef` so the user can re-query the same
   * food without the "that food is unavailable" deduplication guard firing.
   */
  const toggleSuggestedFood = useCallback(
    (food: CartFoodItem) => {
      const foodName = getCartFoodName(food, conversationLang);
      const alreadyAdded = isInCart(food.name.en);

      if (alreadyAdded) {
        const cartIndex = cart.findIndex((item) => item.name.en === food.name.en);
        if (cartIndex !== -1) removeFromCart(cartIndex);
        setMealPlanToast(`${foodName} ${t[conversationLang]?.removedFromMealPlan ?? t.en.removedFromMealPlan}`);
        window.setTimeout(() => setMealPlanToast(""), 2500);
      } else {
        addToCart(food);
      }

      lastUnavailableRequestRef.current = null;
    },
    [addToCart, cart, conversationLang, isInCart, removeFromCart]
  );

  /**
   * Returns the initial message array for a fresh or just-cleared conversation.
   * Reads the latest scan context from sessionStorage so the welcome message
   * reflects the current state (e.g., the "Food Detected" badge is set).
   *
   * Always produces at minimum a welcome message with starter questions.
   * Does NOT add the scan hint — that is handled separately by appendScanHintIfNew
   * via a queued microtask in the language-change effect.
   */
  const getFreshWelcomeMessages = useCallback((): Message[] => {
    const ctx = readScanContext();
    const freshMessages: Message[] = [
      {
        role: "assistant",
        content: tx.welcome,
        starterQuestions: tx.suggestedQ,
        id: uid(),
      },
    ];

    setScanContext(ctx);
    return freshMessages;
  }, [tx.suggestedQ, tx.welcome]);

  // Page language changed: refresh welcome + starters when no real chat yet; otherwise append switch notice.
  useEffect(() => {
    if (!isOpen || !hasInitialised) return;
    if (lastRequestedLangRef.current === lang) return;

    const snapshot = messagesRef.current;
    const hasPendingImages = pendingImagesRef.current.length > 0;
    const hasImagePreviews = Object.keys(messageImagePreviews).length > 0;

    if (!hasPendingImages && !hasImagePreviews && isChatInInitialSeedState(snapshot)) {
      lastRequestedLangRef.current = lang;
      conversationLangRef.current = lang;
      setConversationLang(lang);
      const fresh = getFreshWelcomeMessages();
      setMessages(fresh);
      queueMicrotask(() => {
        if (sessionQualifiesForAnalysisHintBanner()) {
          const id = readAnalysisIdFromSession();
          if (id) appendScanHintIfNew(id);
        }
      });
      requestAnimationFrame(() => scrollChatToBottom());
      setTimeout(() => scrollChatToBottom(), 50);
      setTimeout(() => scrollChatToBottom(), 150);
      setTimeout(() => scrollChatToBottom(false), 300);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        kind: "system",
        content: tx.languageSwitched,
        id: uid(),
      },
    ]);
    lastRequestedLangRef.current = lang;
    conversationLangRef.current = lang;
    setConversationLang(lang);

    requestAnimationFrame(() => scrollChatToBottom());
    setTimeout(() => scrollChatToBottom(), 50);
    setTimeout(() => scrollChatToBottom(), 150);
    setTimeout(() => scrollChatToBottom(false), 300);
  }, [lang, isOpen, hasInitialised, getFreshWelcomeMessages, tx.languageSwitched, scrollChatToBottom, appendScanHintIfNew]);

  /**
   * Resets the entire chat session to a clean welcome state.
   * Called when the user confirms the "Clear chat" action.
   *
   * Steps:
   *   1. Asks for browser confirmation (window.confirm)
   *   2. Cancels any in-flight API request and voice recognition session
   *   3. Revokes all pending image object URLs to prevent memory leaks
   *   4. Clears scan context from sessionStorage and in-memory state
   *   5. Resets language tracking refs to the current page language
   *   6. Generates fresh welcome messages and persists them to sessionStorage
   *   7. Focuses the input field
   */
  const clearConversation = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm(tx.clearConfirm)) return;
    chatAbortRef.current?.abort();
    recognitionRef.current?.abort();
    imagePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    imagePreviewUrlsRef.current.clear();
    setMessageImagePreviews({});
    setPendingImages([]);
    chatAbortRef.current = null;
    setIsLoading(false);
    setIsListening(false);
    setVoiceNotice("");
    lastUnavailableRequestRef.current = null;
    conversationLangRef.current = lang;
    setConversationLang(lang);
    lastRequestedLangRef.current = lang;
    // Explicitly clear food context on clear-chat
    clearStoredScanContext();
    lastScanContextRawRef.current = null;
    lastHandledAnalysisHintIdRef.current = null;
    pendingAnalysisHintIdRef.current = null;
    setScanContext(null);
    setHasActiveFoodContext(false);
    const freshMessages = getFreshWelcomeMessages();
    setMessages(freshMessages);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(freshMessages));
    setInput("");
    setHasInitialised(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [getFreshWelcomeMessages, lang, tx.clearConfirm]);

  /**
   * Builds the text summary shown in a photo-analysis reply message.
   * Lists up to 5 detected food names, category groups, and optionally the
   * healthiest choice (when the user's text asked for a comparison).
   * Appends a high-nutrient warning line when any item is high in fat/sodium.
   *
   * @param ctx          - The scan context produced by /api/predict.
   * @param userText     - The user's message text (used to detect comparison intent).
   * @param responseLang - Language for all localized strings in the reply.
   * @returns A newline-separated multi-line summary string.
   */
  const buildPhotoSummary = useCallback(
    (ctx: ScanContext, userText = "", responseLang: LangCode): string => {
      const txR = t[responseLang] ?? t.en;
      const names = getScanFoodNames(ctx).slice(0, 5);
      const lines = [`${txR.foundFoods}`, ...names.map((name) => `• ${name}`)];
      const categories = getScanCategoryNames(ctx, responseLang);
      if (categories.length) {
        lines.push("", txR.foundCategories, ...categories.map((category) => `• ${category}`));
      }
      const bestName = isHealthierComparisonRequest(userText) ? getLowestRiskFoodName(ctx) : null;
      if (bestName) {
        lines.push(
          "",
          responseLang === "zh"
            ? `较健康的选择：${bestName}`
            : responseLang === "ms"
            ? `Pilihan yang lebih sihat: ${bestName}`
            : `Healthier choice: ${bestName}`
        );
      }
      if (hasHighFatOrSodium(ctx)) {
        lines.push("", txR.highNutrientSummary);
      }
      return lines.join("\n");
    },
    []
  );

  /**
   * Builds an automatic best-choice summary reply for cases where the API
   * returned a "which category?" prompt instead of a direct answer.
   * The component intercepts such replies client-side and uses this function
   * to generate a direct response instead, avoiding the extra user interaction.
   *
   * @param ctx          - The current scan context.
   * @param responseLang - Language for all localized strings.
   * @returns A newline-separated summary string.
   */
  const buildAutomaticBestChoiceSummary = useCallback(
    (ctx: ScanContext, responseLang: LangCode): string => {
      const txR = t[responseLang] ?? t.en;
      const categories = getScanCategoryNames(ctx, responseLang);
      const bestName = getLowestRiskFoodName(ctx);
      const lines =
        responseLang === "zh"
          ? ["我已查看找到的食物。"]
          : responseLang === "ms"
          ? ["Saya telah menyemak makanan yang dijumpai."]
          : ["I checked the foods I found."];

      if (categories.length) {
        lines.push("", txR.foundCategories, ...categories.map((category) => `• ${category}`));
      }

      if (bestName) {
        lines.push(
          "",
          responseLang === "zh"
            ? `较健康的选择：${bestName}`
            : responseLang === "ms"
            ? `Pilihan yang lebih sihat: ${bestName}`
            : `Healthier choice: ${bestName}`
        );
      }

      return lines.join("\n");
    },
    []
  );

  /**
   * Handles the "View Detailed Analysis" button click.
   * Validates that a scan context exists, then either:
   *   a) Dispatches a same-page scroll event if already on /recommendation
   *   b) Navigates to /recommendation with a fromChatbot=1 query param
   *
   * The navigation URL includes a cache-busting timestamp so the browser
   * doesn't serve a stale cached version of the recommendation page.
   *
   * Guards against navigation when no valid scan context is available
   * (defensive check to prevent the recommendation page from rendering empty).
   *
   * @param href - The target href, typically "/recommendation".
   */
  const openFullAnalysis = useCallback((href: string) => {
    // Safety guard: if no valid scan context exists in sessionStorage, block everything.
    const guardCtx = readScanContext();
    if (!guardCtx || !hasScanContextItems(guardCtx)) {
      console.warn("[Chatbot] openFullAnalysis: no valid scan context — navigation blocked");
      return;
    }

    const emitViewDetailAnalysisHint = () => {
      const analysisId = readAnalysisIdFromSession();
      const ctx = readScanContext();
      if (!analysisId || !ctx || !hasScanContextItems(ctx)) return;
      notifyAnalysisReady({
        analysisId,
        source: "chatbot-view-detail",
        foodNames: extractFoodNamesFromPredictResults(ctx as Record<string, unknown>),
      });
    };

    // If the user is already on the recommendation page, avoid a full navigation.
    // Instead dispatch a custom event that tells the page to sync the latest
    // chatbot result and smooth-scroll to the analysis result section.
    if (pathname === "/recommendation") {
      emitViewDetailAnalysisHint();
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent("sihat_view_analysis"));
      return;
    }
    const scanRaw = sessionStorage.getItem(SCAN_CONTEXT_KEY);
    const sessionRaw = sessionStorage.getItem(ANALYSIS_SESSION_KEY);
    console.log("[Chatbot] openFullAnalysis: scan context saved?", {
      hasScanResult: !!scanRaw,
      hasAnalysisSession: !!sessionRaw,
      sessionSource: sessionRaw ? (JSON.parse(sessionRaw) as { source?: string }).source : null,
    });
    emitViewDetailAnalysisHint();
    const separator = href.includes("?") ? "&" : "?";
    const url = `${href}${separator}fromChatbot=1&ts=${Date.now()}`;
    // Push first so the navigation is committed before the component re-renders
    // from setIsOpen(false). On mobile Safari, closing first can cause the push
    // to be dropped when the component unmounts rapidly.
    router.push(url);
    setIsOpen(false);
  }, [pathname, router]);

  /**
   * Handles file selection from the hidden image input element.
   * Filters for image files only, respects the MAX_CHAT_UPLOAD_IMAGES cap,
   * and creates object URLs for preview.  Shows a notice if the limit would
   * be exceeded.  Does nothing if loading or photo analysis is in progress.
   */
  const handleImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!files.length || isLoading || isPhotoAnalyzing) return;

      const uploadTx = t[conversationLangRef.current];
      if (!supportsImageUpload) {
        setMessages((prev) => [...prev, { role: "assistant", content: uploadTx.imageUnsupported, id: uid() }]);
        return;
      }

      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (!imageFiles.length) {
        setMessages((prev) => [...prev, { role: "assistant", content: uploadTx.photoFailed, id: uid() }]);
        return;
      }

      const remainingSlots = Math.max(0, MAX_CHAT_UPLOAD_IMAGES - pendingImages.length);
      if (remainingSlots === 0) {
        setVoiceNotice(uploadTx.maxPhotos);
        return;
      }

      const nextImages = imageFiles.slice(0, remainingSlots).map((file) => {
        const url = URL.createObjectURL(file);
        imagePreviewUrlsRef.current.add(url);
        return { id: uid(), file, url };
      });

      setPendingImages((prev) => [...prev, ...nextImages]);
      setVoiceNotice(imageFiles.length > remainingSlots ? uploadTx.maxPhotos : "");
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [isLoading, isPhotoAnalyzing, pendingImages.length, supportsImageUpload]
  );

  /**
   * Removes a single staged image from the pending images list and revokes
   * its object URL.  Clears the voice/notice area so any old messages don't
   * linger after the image is gone.
   *
   * @param imageId - The unique ID of the PendingChatImage to remove.
   */
  const removePendingImage = useCallback(
    (imageId: string) => {
      setPendingImages((prev) => {
        const imageToRemove = prev.find((image) => image.id === imageId);
        if (imageToRemove) revokeImagePreview(imageToRemove.url);
        return prev.filter((image) => image.id !== imageId);
      });
      setVoiceNotice("");
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [revokeImagePreview]
  );

  /**
   * Opens a pending image in a new browser tab for a full-size preview.
   * We open in a new tab rather than using a modal here because this is the
   * pre-send preview; the in-conversation image modal is handled by
   * `previewImageUrl` state + the overlay in the render.
   *
   * @param url - The object URL of the pending image.
   */
  const previewPendingImage = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  /**
   * Sends the staged images to /api/predict and processes the response.
   *
   * Steps:
   *   1. Detects the language from the user's text (or falls back to conversationLang)
   *   2. Appends the user message to the conversation with image previews attached
   *   3. Converts images to data URLs for sessionStorage and sends via FormData to /api/predict
   *   4. If no food is detected → clears scan context and shows noFoodDetected message
   *   5. If food is detected → saves to sessionStorage, updates in-memory scan context,
   *      and shows a photo summary message with individual food cards and an action button
   *   6. On any error → shows photoFailed message
   *
   * @param text - The optional user text entered alongside the images.
   */
  const analysePendingImages = useCallback(
    async (text: string) => {
      const imagesToSend = pendingImages;
      if (!imagesToSend.length || isLoading || isPhotoAnalyzing) return;

      const photoMsgLang = getUserMessageLanguage(text.trim(), conversationLangRef.current);
      const txPhoto = t[photoMsgLang] ?? t.en;
      const typedLanguageSwitchMsg: Message | null =
        photoMsgLang !== conversationLangRef.current
          ? {
              role: "assistant",
              kind: "system",
              content: t[photoMsgLang].languageSwitched,
              id: uid(),
            }
          : null;

      const messageId = uid();
      const userMsg: Message = { role: "user", content: text.trim() || txPhoto.uploadPhotoUser, id: messageId };
      setMessageImagePreviews((prev) => ({ ...prev, [messageId]: imagesToSend.map((image) => image.url) }));
      setMessages((prev) => [...prev, userMsg, ...(typedLanguageSwitchMsg ? [typedLanguageSwitchMsg] : [])]);
      conversationLangRef.current = photoMsgLang;
      setConversationLang(photoMsgLang);
      setPendingImages([]);
      setInput("");
      setIsPhotoAnalyzing(true);
      setVoiceNotice("");

      try {
        const imagePreviews = await Promise.all(
          imagesToSend.map((image) => fileToDataUrl(image.file).catch(() => image.url))
        );
        const formData = new FormData();
        imagesToSend.forEach((image) => formData.append("file", image.file));
        if (text.trim()) formData.append("userText", text.trim());
        formData.append("language", photoMsgLang);

        const res = await fetch("/api/predict", { method: "POST", body: formData });
        if (!res.ok) {
          throw new Error("Prediction failed");
        }

        const data = (await res.json()) as ScanContext;
        if (!hasScanContextItems(data)) {
          clearStoredScanContext();
          lastScanContextRawRef.current = null;
          setScanContext(null);
          setHasActiveFoodContext(false);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: txPhoto.noFoodDetected, id: uid(), locale: photoMsgLang },
          ]);
          return;
        }

        const raw = JSON.stringify(data);
        saveScanContext(
          raw,
          {
            imagePreviews,
            userText: text.trim(),
            selectedCategory: getFirstAnalysisCategory(data),
          }
        );
        lastScanContextRawRef.current = raw;
        setScanContext(data);
        setHasActiveFoodContext(true);

        const scannedFoods = getScanFoodItems(data);
        const scanFood: ScanFoodSummary | undefined =
          scannedFoods.length === 1 ? foodItemToScanSummary(scannedFoods[0]!, data, photoMsgLang) : undefined;
        const scanFoods: ScanFoodSummary[] | undefined =
          scannedFoods.length > 1
            ? scannedFoods.map((item) => foodItemToScanSummary(item, data, photoMsgLang))
            : undefined;
        const assistantContent =
          scannedFoods.length > 1 ? txPhoto.foundFoods : buildPhotoSummary(data, text, photoMsgLang);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: assistantContent,
            scanFood,
            scanFoods,
            actionButton: { label: txPhoto.openFullAnalysis, href: "/recommendation" },
            locale: photoMsgLang,
            id: uid(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: txPhoto.photoFailed, id: uid(), locale: photoMsgLang },
        ]);
      } finally {
        setIsPhotoAnalyzing(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [buildPhotoSummary, isLoading, isPhotoAnalyzing, pendingImages]
  );

  /**
   * Adjusts the textarea height dynamically as the user types.
   * On mobile the bar stays compact (single-line minimum), while on desktop
   * the empty placeholder is taller to show the full hint text.
   * The height is capped at `maxH` to prevent the input bar from taking up
   * too much of the panel on very long messages.
   */
  const resizeInput = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    // Mobile: single-line compact bar; desktop: taller empty placeholder.
    const emptyMin = isDesktop ? 72 : 56;
    const maxH = isDesktop ? 112 : 96;
    const minHeight = textarea.value.trim() ? 48 : emptyMin;
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxH)}px`;
  }, [isDesktop]);

  useLayoutEffect(() => {
    resizeInput();
  }, [input, resizeInput, tx.placeholder]);

  /**
   * Core message-sending function.  Handles the full pipeline for a user
   * message turn, including all pre-API client-side interceptions.
   *
   * Pre-API intercept order:
   *   1. If pending images → delegate to analysePendingImages and return.
   *   2. Empty / loading guard → return early.
   *   3. Language detection → set conversationLang; insert language-switch notice if changed.
   *   4. Onboarding intent (starter questions) → static reply, no API call.
   *   5. Meal-plan intent (add/remove cart) → execute cart action, static reply, no API call.
   *   6. Analysis reset intent → clear scan context, static reply, no API call.
   *   7. Repeat unavailable guard → reply with stillUnavailable, no API call.
   *
   * API call path:
   *   8. Build request body (message, history, language, scanContext, cart, intakeSummary).
   *   9. POST to /api/chat via fetch with an AbortController for stopResponding().
   *  10. Handle response: execute cart action if present, update lastUnavailable ref,
   *      rebuild in-memory scan context from food payload, append assistant message.
   *  11. On abort → do nothing (user stopped); on other error → show errorRetry.
   *
   * @param text    - The user's message text.
   * @param options - `{ retry: true }` when this is a retry of a previous failed message.
   */
  const sendMessage = useCallback(
    async (text: string, options?: { retry?: boolean }) => {
      const trimmed = text.trim();
      if (!options?.retry && pendingImages.length) {
        await analysePendingImages(trimmed);
        return;
      }
      if (!trimmed || isLoading || isPhotoAnalyzing || isSendingRef.current) return;
      isSendingRef.current = true;
      const repeatKey = normalizeRepeatKey(trimmed);
      const messageLang = getUserMessageLanguage(trimmed, conversationLangRef.current);
      const shouldShowTypedLanguageSwitch = messageLang !== conversationLangRef.current;
      const typedLanguageSwitchMsg: Message | null = shouldShowTypedLanguageSwitch
        ? {
            role: "assistant",
            kind: "system",
            content: t[messageLang].languageSwitched,
            id: uid(),
          }
        : null;
      const onboardingIntent = !options?.retry ? getOnboardingIntent(trimmed) : null;

      if (onboardingIntent) {
        const userMsg: Message = { role: "user", content: trimmed, id: uid() };
        const msgTx = t[messageLang];
        const onboardingContent =
          onboardingIntent === "food-check"
            ? msgTx.foodCheckGuide
            : onboardingIntent === "meal-plan"
            ? msgTx.mealPlanGuide
            : msgTx.learnGuide;
        const onboardingActionButton =
          onboardingIntent === "meal-plan"
            ? { label: msgTx.openFoodPage, href: "/food" }
            : onboardingIntent === "learn"
            ? { label: msgTx.openLearnPage, href: "/learn" }
            : undefined;
        const assistantMsg: Message = {
          role: "assistant",
          content: onboardingContent,
          ...(onboardingActionButton ? { actionButton: onboardingActionButton } : {}),
          id: uid(),
        };

        setMessages((prev) => [
          ...prev,
          userMsg,
          ...(typedLanguageSwitchMsg ? [typedLanguageSwitchMsg] : []),
          assistantMsg,
        ]);
        conversationLangRef.current = messageLang;
        setConversationLang(messageLang);
        setInput("");
        isSendingRef.current = false;
        return;
      }

      // Intercept natural-language add/remove cart commands so the LLM never
      // replies "I cannot access the cart." — we execute the real action instead.
      const mealPlanIntent = !options?.retry ? getMealPlanIntent(trimmed) : null;
      if (mealPlanIntent) {
        const userMsg: Message = { role: "user", content: trimmed, id: uid() };
        const foodCtx = getLatestFoodContext(messages);
        const msgTx = t[messageLang];
        let replyContent: string;

        if (foodCtx.status === "none") {
          replyContent = msgTx.cartNoContext;
        } else if (foodCtx.status === "unavailable") {
          replyContent = msgTx.cartNotAvailable;
        } else {
          // status === "available"
          const food = foodCtx.food;
          const foodName = getCartFoodName(food, messageLang);
          if (mealPlanIntent === "add") {
            if (isInCart(food.name.en)) {
              replyContent = `${foodName} ${msgTx.cartAlreadyIn}`;
            } else {
              addToCart(food);
              replyContent = `✓ ${foodName} ${msgTx.cartAdded}`;
            }
          } else {
            const cartIndex = cart.findIndex((item) => item.name.en === food.name.en);
            if (cartIndex === -1) {
              replyContent = `${foodName} ${msgTx.cartNotIn}`;
            } else {
              removeFromCart(cartIndex);
              replyContent = `✓ ${foodName} ${msgTx.cartRemoved}`;
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          userMsg,
          ...(typedLanguageSwitchMsg ? [typedLanguageSwitchMsg] : []),
          { role: "assistant", kind: "system", content: replyContent, id: uid() },
        ]);
        conversationLangRef.current = messageLang;
        setConversationLang(messageLang);
        setInput("");
        isSendingRef.current = false;
        return;
      }

      // Intercept "reset analysis" intent — clear scan context and notify the
      // recommendation page, then reply immediately without calling the LLM.
      if (!options?.retry && isAnalysisResetIntent(trimmed)) {
        const userMsg: Message = { role: "user", content: trimmed, id: uid() };
        clearStoredScanContext();
        lastScanContextRawRef.current = null;
        lastHandledAnalysisHintIdRef.current = null;
        pendingAnalysisHintIdRef.current = null;
        setScanContext(null);
        setHasActiveFoodContext(false);
        window.dispatchEvent(new Event(ANALYSIS_RESET_EVENT));
        setMessages((prev) => [
          ...prev,
          userMsg,
          ...(typedLanguageSwitchMsg ? [typedLanguageSwitchMsg] : []),
          { role: "assistant", kind: "system", content: t[messageLang].analysisReset, id: uid() },
        ]);
        conversationLangRef.current = messageLang;
        setConversationLang(messageLang);
        setInput("");
        isSendingRef.current = false;
        return;
      }

      if (!options?.retry && lastUnavailableRequestRef.current === repeatKey) {
        const userMsg: Message = { role: "user", content: trimmed, id: uid() };
        setMessages((prev) => [
          ...prev,
          userMsg,
          ...(typedLanguageSwitchMsg ? [typedLanguageSwitchMsg] : []),
          { role: "assistant", content: t[messageLang].stillUnavailable, id: uid() },
        ]);
        conversationLangRef.current = messageLang;
        setConversationLang(messageLang);
        setInput("");
        isSendingRef.current = false;
        return;
      }

      const userMsg: Message = { role: "user", content: trimmed, id: uid() };
      const newMessages: Message[] = options?.retry
        ? messages
        : typedLanguageSwitchMsg
        ? [...messages, userMsg, typedLanguageSwitchMsg]
        : [...messages, userMsg];
      setMessages(newMessages);
      conversationLangRef.current = messageLang;
      setConversationLang(messageLang);
      setInput("");
      setIsLoading(true);

      const historySource: Message[] = options?.retry ? [...newMessages, userMsg] : newMessages;
      const historyMessages: ChatMessage[] = historySource.slice(-6).map(({ role, content }) => ({ role, content }));
      if (lang !== lastRequestedLangRef.current) {
        const languageGuards: Record<LangCode, string> = {
          en: "The user switched language to English. Answer future messages in English.",
          ms: "The user switched language to Bahasa Malaysia. Answer future messages in Bahasa Malaysia.",
          zh: "The user switched language to Simplified Chinese. Answer future messages in Simplified Chinese.",
        };
        historyMessages.unshift({ role: "assistant", content: languageGuards[lang] });
        lastRequestedLangRef.current = lang;
      }

      try {
        const abortController = new AbortController();
        chatAbortRef.current = abortController;
        const gender = readGenderPreference();
        const intakeSummary = buildDailyIntakeSummary(cart, gender, messageLang);
        let scanContextForRequest = readScanContext();
        if (isConversationalClientMessage(trimmed)) {
          // Clear in-memory state so the stale scan context is not forwarded to the
          // API.  Do NOT call clearChatbotTypedFoodScanContext() — that would erase
          // sessionStorage and blank the recommendation page if it's already showing
          // a valid analysis.
          scanContextForRequest = null;
          setScanContext(null);
        }
        setScanContext(scanContextForRequest);
        const requestBody: ChatRequestBody = {
          message: trimmed,
          history: historyMessages,
          language: messageLang,
          scanContext: scanContextForRequest,
          cart,
          intakeSummary,
        };

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        const data = (await res.json()) as ChatResponse;
        const apiReply = data.reply || t[messageLang].errorRetry;
        const categoryPrompt =
          isManualCategoryPrompt(apiReply, data.quickReplies) && hasScanContextItems(scanContextForRequest);
        const reply = categoryPrompt
          ? buildAutomaticBestChoiceSummary(scanContextForRequest!, messageLang)
          : apiReply;
        const quickReplies = categoryPrompt ? undefined : data.quickReplies;
        const hasAnalysableFoodPayload = Boolean(
          data.suggestions?.length || data.estimatedFood || data.estimatedFoods?.length
        );
        const defaultRecommendationButton =
          hasAnalysableFoodPayload && !categoryPrompt
            ? ({ label: t[messageLang].openFullAnalysis, href: "/recommendation" as const } as const)
            : undefined;
        const mergedActionButton = categoryPrompt
          ? { label: t[messageLang].openFullAnalysis, href: "/recommendation" as const }
          : data.actionButton ?? defaultRecommendationButton;

        if (data.action?.type === "add" && data.action.food) {
          // Guard against stale cart snapshot: don't add if already present
          if (!isInCart(data.action.food.name.en)) {
            addToCart(data.action.food);
          }
        } else if (data.action?.type === "remove" && data.action.food) {
          const cartIndex = cart.findIndex((food) => food.name.en === data.action?.food?.name.en);
          if (cartIndex !== -1) {
            removeFromCart(cartIndex);
          }
        } else if (data.action?.type === "clear") {
          clearCart();
        }

        // Multi-food responses are not "unavailable food" — don't block retries.
        if (!data.isMultiFood && (data.suggestions?.length || data.unavailableFoodName)) {
          lastUnavailableRequestRef.current = repeatKey;
        } else {
          lastUnavailableRequestRef.current = null;
        }

        // This turn has a food card — record active food context for the badge.
        if (hasAnalysableFoodPayload) {
          setHasActiveFoodContext(true);
        }

        // Current turn has no food payload — clear the in-memory scan context so stale
        // data does not leak into the next API call.
        // IMPORTANT: Do NOT touch sessionStorage here.  The recommendation page may
        // already be displaying a valid analysis result that was saved when the user
        // last clicked "View Detailed Analysis".  Clearing sessionStorage would blank
        // that page.  The in-memory scanContext is all the API needs for routing.
        if (
          !data.suggestions?.length &&
          !data.estimatedFood &&
          !data.estimatedFoods?.length &&
          !data.actionButton
        ) {
          setScanContext(null);
        }

        // Update in-memory scan context so follow-up questions work correctly.
        // sessionStorage is NOT written until the user explicitly clicks "View Detailed Analysis".
        if (hasAnalysableFoodPayload && !categoryPrompt) {
          const scanCtx = buildScanContextFromChatbotMessage(
            {
              role: "assistant",
              content: reply,
              id: "pending",
              suggestions: data.suggestions,
              estimatedFood: data.estimatedFood,
              estimatedFoods: data.estimatedFoods,
            },
            messageLang
          );
          if (scanCtx) {
            setScanContext(scanCtx);
            setHasActiveFoodContext(true);
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply,
            suggestions: data.suggestions,
            unavailableFoodName: data.unavailableFoodName,
            quickReplies,
            actionButton: mergedActionButton,
            isMultiFood: data.isMultiFood,
            estimatedFood: data.estimatedFood,
            estimatedFoods: data.estimatedFoods,
            locale: messageLang,
            id: uid(),
          },
        ]);
      } catch {
        if (chatAbortRef.current?.signal.aborted) return;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: t[messageLang].errorRetry, id: uid(), locale: messageLang },
        ]);
      } finally {
        chatAbortRef.current = null;
        isSendingRef.current = false;
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [addToCart, analysePendingImages, buildAutomaticBestChoiceSummary, cart, clearCart, isLoading, isPhotoAnalyzing, lang, messages, pendingImages.length, removeFromCart]
  );

  /**
   * Cancels the current in-flight API request and appends a system message
   * informing the user that the response was stopped.
   * No-ops when not currently loading (e.g., double-click guard).
   */
  const stopResponding = useCallback(() => {
    if (!isLoading) return;
    chatAbortRef.current?.abort();
    setIsLoading(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", kind: "system", content: conversationTxRef.current.responseStopped, id: uid() },
    ]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isLoading]);

  /**
   * Copies an assistant message to the clipboard.
   * Strips the "!HIGH_NUTRITION! " sentinel prefix before copying so the
   * user doesn't paste internal formatting markers.
   *
   * Strategy:
   *   1. Try the modern Clipboard API (works on HTTPS desktop/mobile).
   *   2. Fall back to a hidden textarea + document.execCommand("copy") for
   *      mobile Safari and older browsers that don't support the Clipboard API.
   *   3. Show a brief notice ("Copied" or "Copy failed") via voiceNotice state.
   */
  const copyAssistantMessage = useCallback(
    async (content: string) => {
      const text = content.replace(/^!HIGH_NUTRITION! /gm, "");

      // Primary: Clipboard API (works on desktop and modern mobile browsers).
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        try {
          await navigator.clipboard.writeText(text);
          setVoiceNotice(tx.copied);
          return;
        } catch {
          // Fall through to execCommand fallback.
        }
      }

      // Fallback: execCommand — works on mobile Safari and older browsers.
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "");
        el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
        document.body.appendChild(el);
        el.focus();
        el.select();
        // iOS Safari requires setSelectionRange after select().
        el.setSelectionRange(0, el.value.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        setVoiceNotice(ok ? tx.copied : tx.copyFailed);
      } catch {
        setVoiceNotice(tx.copyFailed);
      }
    },
    [tx.copied, tx.copyFailed]
  );

  /**
   * Finds the user message that immediately precedes a given assistant message
   * in the conversation array.  Used to extract the original question when
   * the user clicks "Try again" on a failed assistant response.
   *
   * @param assistantIndex - The index of the assistant message in `messages`.
   * @returns The user message content string, or null if not found.
   */
  const getPreviousUserMessage = useCallback(
    (assistantIndex: number): string | null => {
      for (let index = assistantIndex - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === "user") return messages[index].content;
      }
      return null;
    },
    [messages]
  );

  /**
   * Retries a failed or unsatisfactory assistant message by re-sending the
   * user message that preceded it with the `retry: true` flag.
   * The retry flag bypasses pre-API client-side intercepts (onboarding intent,
   * meal-plan intent, etc.) and goes straight to the API call.
   *
   * @param assistantIndex - The index of the assistant message to retry from.
   */
  const retryAssistantMessage = useCallback(
    (assistantIndex: number) => {
      const previousUserMessage = getPreviousUserMessage(assistantIndex);
      if (!previousUserMessage) return;
      sendMessage(previousUserMessage, { retry: true });
    },
    [getPreviousUserMessage, sendMessage]
  );

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  /**
   * Toggles the Web Speech API voice input session.
   *
   * If currently listening → stops recognition (transcript is applied in `onend`).
   * If not listening → creates a new recognition instance, sets the language,
   *   enables continuous + interim results, and starts.
   *
   * Voice input behaviour:
   *   - Transcript is accumulated in `pendingVoiceTranscriptRef` during the session.
   *   - On `onend`, the transcript is inserted into the input textarea (NOT auto-sent)
   *     so the user can review and edit before sending.
   *   - If no speech was detected, shows the voiceNoSpeech notice.
   *   - If the API is not available, hides the microphone button.
   */
  const toggleVoiceInput = useCallback(() => {
    if (typeof window === "undefined" || isLoading || isPhotoAnalyzing) return;

    if (isListening) {
      recognitionRef.current?.stop();
      inputRef.current?.focus();
      return;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSupportsVoiceInput(false);
      setVoiceNotice("");
      return;
    }

    pendingVoiceTranscriptRef.current = "";
    setVoiceNotice("");

    const recognition = new Recognition();
    recognition.lang = getSpeechRecognitionLanguage(lang);
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcriptParts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        transcriptParts.push(event.results[i]?.[0]?.transcript.trim() ?? "");
      }

      const transcript = transcriptParts.filter(Boolean).join(" ");
      if (transcript) {
        pendingVoiceTranscriptRef.current = transcript;
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      if (!pendingVoiceTranscriptRef.current.trim()) {
        setVoiceNotice(tx.voiceNoSpeech);
      }
      inputRef.current?.focus();
    };

    recognition.onend = () => {
      const transcript = pendingVoiceTranscriptRef.current.trim();
      if (transcript) {
        setInput((current) => {
          const separator = current.trim() ? " " : "";
          return `${current.trimEnd()}${separator}${transcript}`;
        });
        setVoiceNotice("");
      } else {
        setVoiceNotice(tx.voiceNoSpeech);
      }
      pendingVoiceTranscriptRef.current = "";
      setIsListening(false);
      inputRef.current?.focus();
    };

    recognitionRef.current = recognition;
    setIsListening(true);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceNotice(tx.voiceNoSpeech);
      inputRef.current?.focus();
    }
  }, [isListening, isLoading, isPhotoAnalyzing, lang, tx.voiceNoSpeech]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating Button ── */}
      {!isFoodDetailModalOpen && (
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="fixed w-16 h-16 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          style={{
            background: "linear-gradient(135deg, #0a7a74 0%, #047a57 100%)",
            border: "2px solid #047a57",
            right: "2rem",
            bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            zIndex: 70,
          }}
          aria-label={isOpen ? tx.ariaClose : tx.ariaOpen}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDown className="w-7 h-7" />
          ) : (
            <Bot className="w-8 h-8" />
          )}
        </button>
      )}

      {/* ── Chat Window ── */}
      {isOpen && !isFoodDetailModalOpen && (
        <>
          <div
            // Keep the click-away layer below the navbar and its open language menu.
            className="fixed left-0 right-0 bottom-0 top-16 md:top-20 transition-opacity duration-200"
            style={{ zIndex: 60 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed inset-x-4 sm:inset-x-auto sm:w-[520px] lg:w-[560px] flex flex-col rounded-xl overflow-hidden shadow-xl bg-white transition-opacity duration-200"
            style={{
              top: "calc(4.5rem + env(safe-area-inset-top))",
              right: "2rem",
              bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
              border: "1.5px solid #0a7a74",
              transform: "translateY(16px)",
              zIndex: 70,
            }}
            role="dialog"
            aria-label={tx.title}
          >
          {/* ── Header — teal green to stand out from the dark blue site ── */}
          <div className="px-4 py-3 text-white shrink-0" style={{ background: "linear-gradient(135deg, #0a7a74 0%, #047a57 100%)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight">{tx.title}</p>
                  <p className="text-sm text-white/85 leading-snug">{tx.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="min-h-11 min-w-11 shrink-0 p-2 rounded-full hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label={tx.ariaClose}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="ml-[52px] mt-2 flex flex-wrap items-center gap-2">
              {hasActiveFoodContext && (
                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-100/70 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900">
                  <Utensils className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {ctx.foodDetected}
                </span>
              )}
              <button
                type="button"
                onClick={clearConversation}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label={tx.clearChat}
                title={tx.clearChat}
              >
                <Trash2 className="h-4 w-4" />
                <span>{tx.clearChat}</span>
              </button>
            </div>
          </div>

          {/* ── Messages ── */}
          <div
            ref={messagesScrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 bg-gray-50"
            style={{ touchAction: "pan-y" }}
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.map((msg, index) => {
              const cardLang = msg.locale ?? conversationLang ?? lang;
              const mctx = t[cardLang] ?? t.en;
              return (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2" style={{ background: "linear-gradient(135deg, #0a7a74, #047a57)" }}>
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="max-w-[82%]">
                  <div
                    className={`px-4 py-3 rounded-2xl leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                      msg.role === "user"
                        ? "text-white rounded-tr-sm"
                        : msg.kind === "system"
                        ? "bg-gray-100 text-gray-700 border border-gray-200 rounded-tl-sm shadow-none italic"
                        : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm"
                    }`}
                    style={{
                      fontSize: msg.kind === "system" ? "15px" : "18px",
                      lineHeight: msg.kind === "system" ? "1.6" : "1.75",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      ...(msg.role === "user" ? { background: "linear-gradient(135deg, #0a7a74, #047a57)" } : {}),
                    }}
                  >
                    {msg.role === "user" && messageImagePreviews[msg.id]?.length ? (
                      <div className="mb-2 grid grid-cols-1 gap-2">
                        {messageImagePreviews[msg.id].map((url, imageIndex) => (
                          <button
                            key={`${msg.id}-${url}`}
                            type="button"
                            onClick={() => setPreviewImageUrl(url)}
                            className="block max-w-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                            aria-label={`${tx.previewPhoto} ${imageIndex + 1}`}
                            title={tx.previewPhoto}
                          >
                            <img
                              src={url}
                              alt={`${tx.uploadPhotoUser} ${imageIndex + 1}`}
                              className="block h-auto max-h-48 w-64 max-w-full rounded-xl border border-white/30 object-cover shadow-sm sm:w-72"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {msg.role === "assistant" && msg.scanFoods?.length ? (
                      <div className="space-y-5">
                        {msg.content.trim() ? (
                          <p className="mb-1 font-semibold text-gray-800" style={{ fontSize: "18px", lineHeight: "1.65" }}>
                            {msg.content}
                          </p>
                        ) : null}
                        {msg.scanFoods.map((sf, scanIdx) => (
                          <FoodScanSummary key={`${msg.id}-sf-${scanIdx}`} scanFood={sf} lang={cardLang} />
                        ))}
                      </div>
                    )
                    : msg.role === "assistant" && msg.isMultiFood && (msg.suggestions?.length || msg.estimatedFoods?.length)
                      ? (
                        <div className="space-y-5">
                          {msg.suggestions?.map((food) => (
                            <FoodItemCard key={food.name.en} food={food} lang={cardLang} />
                          ))}
                          {msg.estimatedFoods?.map((food) => (
                            <AiFoodCard key={food.name} food={food} lang={cardLang} />
                          ))}
                        </div>
                      )
                      : msg.role === "assistant" && msg.estimatedFood
                      ? <AiFoodCard food={msg.estimatedFood} lang={cardLang} />
                      : msg.role === "assistant" && (msg.scanFood || msg.suggestions?.length === 1)
                      ? <FoodSummaryCard
                          content={msg.content}
                          food={msg.suggestions?.[0]}
                          scanFood={msg.scanFood}
                          lang={cardLang}
                        />
                      : msg.role === "assistant" && msg.starterQuestions?.length && !hasUserMessage
                      ? renderMessageContent(ctx.welcome)
                      : renderMessageContent(msg.content)}
                    {msg.role === "assistant" &&
                    msg.starterQuestions?.length &&
                    !hasUserMessage &&
                    !isLoading &&
                    !isPhotoAnalyzing &&
                    !input.trim() ? (
                      <div className="mt-3 grid w-full gap-2">
                        {(t[conversationLang] ?? t.en).suggestedQ.map((question, questionIndex) => {
                          const StarterIcon = questionIndex === 0 ? Utensils : questionIndex === 1 ? ClipboardList : BookOpen;
                          const isPrimaryStarter = questionIndex === 0;
                          return (
                          <button
                            key={`starter-${questionIndex}`}
                            type="button"
                            onClick={() => sendMessage(question)}
                            className="flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left font-semibold transition-colors hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            style={{
                              borderColor: isPrimaryStarter ? "#7bc7c1" : "#c7e2f0",
                              color: isPrimaryStarter ? "#064e3b" : "#1f4f63",
                              background: isPrimaryStarter ? "#ecfdf5" : "#f4fbfd",
                              fontSize: "16px",
                              lineHeight: "1.35",
                              boxShadow: isPrimaryStarter ? "0 1px 0 rgba(10,122,116,0.14)" : "none",
                            }}
                          >
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                              style={{
                                background: isPrimaryStarter ? "#d1fae5" : "#e6f4fa",
                                color: isPrimaryStarter ? "#047a57" : "#1f6f88",
                              }}
                              aria-hidden="true"
                            >
                              <StarterIcon className="h-5 w-5" />
                            </span>
                            <span>{question}</span>
                          </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  {msg.role === "assistant" && msg.actionButton ? (
                    <div className="mt-2" style={{ position: "relative", zIndex: 10 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const href = msg.actionButton!.href;
                          if (href === "/food") {
                            console.log("[Chatbot] Open Food Page clicked");
                            router.push("/food");
                            setIsOpen(false);
                          } else if (href === "/learn") {
                            console.log("[Chatbot] Open Learn Page clicked");
                            router.push("/learn");
                            setIsOpen(false);
                          } else if (href.includes("/recommendation")) {
                            const saved = prepareRecommendationNavigationForMessage(msg, cardLang);
                            if (saved) {
                              setScanContext(readScanContext());
                              openFullAnalysis(href);
                            } else {
                              console.warn("[Chatbot] View Detailed Analysis: invalid payload — navigation blocked");
                            }
                          } else {
                            openFullAnalysis(href);
                          }
                        }}
                        className="min-h-12 w-full rounded-xl border-2 px-4 py-3 font-bold shadow-sm text-white cursor-pointer select-none transition-all active:opacity-90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        style={{
                          background: "linear-gradient(135deg, #0a7a74, #047a57)",
                          borderColor: "#047a57",
                          fontSize: "18px",
                          lineHeight: "1.35",
                          touchAction: "manipulation",
                          pointerEvents: "auto",
                          position: "relative",
                          zIndex: 10,
                        }}
                      >
                        {msg.actionButton.href === "/recommendation"
                          ? mctx.openFullAnalysis
                          : msg.actionButton.href === "/learn"
                          ? mctx.openLearnPage
                          : msg.actionButton.href === "/food"
                          ? mctx.openFoodPage
                          : msg.actionButton.label}
                      </button>
                    </div>
                  ) : null}
                  {msg.role === "assistant" && msg.suggestions?.length ? (
                    <div className="mt-2 flex flex-col gap-2">
                      {msg.suggestions.map((food) => {
                        const foodName = getCartFoodName(food, cardLang);
                        const alreadyAdded = isInCart(food.name.en);
                        return (
                          <button
                            key={food.name.en}
                            type="button"
                            onClick={() => toggleSuggestedFood(food)}
                            aria-pressed={alreadyAdded}
                            className="w-full min-h-14 rounded-xl border-2 px-4 py-3 text-left font-bold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            style={{
                              borderColor: alreadyAdded ? "#16a34a" : "#22c55e",
                              background: alreadyAdded ? "#dcfce7" : "white",
                              color: "#14532d",
                              fontSize: "18px",
                              lineHeight: "1.35",
                            }}
                          >
                            <span className="flex items-center gap-2">
                              {alreadyAdded ? <Check className="h-5 w-5 shrink-0 text-green-600" /> : <Plus className="h-5 w-5 shrink-0" />}
                              <span className="flex flex-col gap-0.5">
                                <span>{alreadyAdded ? ` ${mctx.inMealPlan}: ${foodName}` : ` ${mctx.addToMealPlan}: ${foodName}`}</span>
                                {alreadyAdded && (
                                  <span style={{ fontSize: "13px", color: "#16a34a", fontWeight: "500" }}>
                                    {mctx.tapAgainToRemove}
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {msg.role === "assistant" && msg.quickReplies?.length ? (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.quickReplies.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          onClick={() => sendMessage(reply)}
                          className="min-h-12 rounded-xl border-2 px-4 py-3 text-left font-bold shadow-sm transition-colors bg-white hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          style={{
                            borderColor: "#0a7a74",
                            color: "#064e3b",
                            fontSize: "18px",
                            lineHeight: "1.35",
                          }}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {msg.role === "assistant" && !msg.kind && getPreviousUserMessage(index) ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyAssistantMessage(msg.content)}
                        className="min-h-10 rounded-full px-3 py-1.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label={ctx.copyReply}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Copy className="h-4 w-4" />
                          {ctx.copyReply}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => retryAssistantMessage(index)}
                        disabled={isLoading || isPhotoAnalyzing}
                        className="min-h-10 rounded-full px-3 py-1.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label={ctx.tryAgain}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <RefreshCw className="h-4 w-4" />
                          {ctx.tryAgain}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
                {msg.role === "user" && (
                  <div
                    className="ml-2 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: "linear-gradient(135deg, #0a7a74, #047a57)" }}
                    aria-hidden="true"
                  >
                    <UserRound className="h-5 w-5" />
                  </div>
                )}
              </div>
            );
            })}

            {/* Loading indicator */}
            {(isLoading || isPhotoAnalyzing) && (
              <div className="flex items-start justify-start">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2" style={{ background: "linear-gradient(135deg, #0a7a74, #047a57)" }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#0a7a74" }} />
                    <span className="text-gray-600 font-medium" style={{ fontSize: "16px" }}>
                      {isPhotoAnalyzing ? ctx.photoAnalysing : ctx.sitiResponding}
                    </span>
                  </div>
                  {isLoading && !isPhotoAnalyzing && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={stopResponding}
                        className="min-h-10 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        style={{ borderColor: "#d1d5db", color: "#4b5563", background: "#f9fafb" }}
                        aria-label={ctx.stopResponding}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Square className="h-3.5 w-3.5" />
                          {ctx.stop}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Meal Plan Toast ── */}
          {mealPlanToast && (
            <div
              className="px-4 py-3 shrink-0 flex items-center gap-2 font-semibold"
              style={{ background: "#dcfce7", borderTop: "1.5px solid #86efac", color: "#14532d", fontSize: "16px" }}
              aria-live="polite"
            >
              <Check className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
              {mealPlanToast}
            </div>
          )}

          {/* ── Input Area ── */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
              aria-label={tx.uploadFoodPhoto}
            />
            {pendingImages.length > 0 && (
              <div className="mb-3 rounded-2xl border border-teal-100 bg-teal-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-teal-900">
                    {pendingImages.length}/{MAX_CHAT_UPLOAD_IMAGES} - {tx.maxPhotos}
                  </p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pendingImages.map((image, index) => (
                    <div key={image.id} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => previewPendingImage(image.url)}
                        className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label={`${tx.previewPhoto} ${index + 1}`}
                        title={tx.previewPhoto}
                      >
                        <img src={image.url} alt={`${tx.previewPhoto} ${index + 1}`} className="h-full w-full object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePendingImage(image.id)}
                        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-md transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label={`${tx.removePhoto} ${index + 1}`}
                        title={tx.removePhoto}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div
              // Mobile: flex row so textarea + icons share the same line.
              // Desktop (sm+): relative block so icons can be absolute-positioned.
              className="flex items-end gap-1 sm:block sm:relative rounded-2xl border bg-gray-50 px-3 py-1.5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
              style={{
                borderColor: isListening || isPhotoAnalyzing ? "#0a7a74" : "#d1d5db",
                outlineColor: "#0a7a74",
                boxShadow: isListening || isPhotoAnalyzing ? "0 0 0 3px rgba(15,95,90,0.12)" : "none",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (voiceNotice) setVoiceNotice("");
                }}
                onKeyDown={handleKeyDown}
                // Short single-line placeholder on mobile; full text on desktop.
                placeholder={isDesktop ? tx.placeholder : (
                  conversationLang === "zh" ? "询问 SIHAT…"
                  : conversationLang === "ms" ? "Tanya SIHAT..."
                  : "Ask SIHAT..."
                )}
                rows={1}
                disabled={isLoading || isPhotoAnalyzing}
                // Mobile: flex-1 fills remaining width (no pr-40 needed).
                // Desktop: full width with pr-40 to clear absolute icons.
                className="flex-1 min-w-0 sm:w-full resize-none border-0 bg-transparent px-1 py-2 sm:py-2.5 sm:pr-40 text-gray-800 placeholder-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-y-auto whitespace-pre-wrap break-words placeholder:whitespace-pre-wrap sm:max-h-28"
                style={{ fontSize: "18px", lineHeight: "1.45", outline: "none", overflowWrap: "anywhere", wordBreak: "break-word", minHeight: isDesktop ? undefined : "56px", maxHeight: isDesktop ? undefined : "96px" }}
                aria-label={tx.placeholder}
              />
              {/* Mobile: inline flex; Desktop: absolute bottom-right */}
              <div className="flex items-center gap-1 shrink-0 sm:absolute sm:bottom-1.5 sm:right-2">
                {supportsImageUpload && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isLoading || isPhotoAnalyzing || pendingImages.length >= MAX_CHAT_UPLOAD_IMAGES}
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:cursor-not-allowed disabled:opacity-60 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    style={{
                      color: "#075f59",
                      background: "transparent",
                    }}
                    aria-label={tx.uploadFoodPhoto}
                    title={tx.uploadFoodPhoto}
                  >
                    <ImagePlus className="h-5 w-5 shrink-0" />
                  </button>
                )}
                {supportsVoiceInput && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    disabled={isLoading || isPhotoAnalyzing}
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    style={{
                      background: isListening ? "#0a7a74" : "transparent",
                      color: isListening ? "white" : "#0a7a74",
                      boxShadow: isListening ? "0 0 0 4px rgba(10,122,116,0.16)" : "none",
                    }}
                    aria-label={isListening ? tx.voiceStop : tx.voiceStart}
                    aria-pressed={isListening}
                  >
                    <Mic className={`w-5 h-5 ${isListening ? "animate-pulse" : ""}`} />
                  </button>
                )}
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || isPhotoAnalyzing || (!input.trim() && pendingImages.length === 0)}
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  style={{
                    background: (input.trim() || pendingImages.length > 0) && !isLoading && !isPhotoAnalyzing ? "linear-gradient(135deg, #0a7a74, #047a57)" : "#e5e7eb",
                    color: (input.trim() || pendingImages.length > 0) && !isLoading && !isPhotoAnalyzing ? "white" : "#6b7280",
                  }}
                  aria-label={tx.send}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            {(isListening || voiceNotice) && (
              <p
                className="mt-2 flex items-center gap-2 font-medium"
                style={{ fontSize: "14px", color: isListening ? "#0a7a74" : "#92400e" }}
                aria-live="polite"
              >
                {isListening && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full animate-pulse"
                    style={{ background: "#0a7a74" }}
                    aria-hidden="true"
                  />
                )}
                <span>{isListening ? `${tx.listening} ${formatRecordingTime(recordingSeconds)}` : voiceNotice}</span>
              </p>
            )}
          </div>

          {/* ── Fixed Disclaimer Bar ── */}
          <div className="px-4 py-3 shrink-0" style={{ background: "#ecfdf5", borderTop: "1.5px solid #6ee7b7" }}>
            <p className="text-center font-semibold" style={{ fontSize: "14px", color: "#064e3b" }}>
              🩺{" "}
              {ctx.disclaimer}
            </p>
          </div>
        </div>
        {previewImageUrl && (
          <div
            className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-black/60 px-4 pb-6"
            style={{ zIndex: 90, paddingTop: "calc(5.5rem + env(safe-area-inset-top))" }}
            role="dialog"
            aria-modal="true"
            aria-label={tx.previewPhoto}
            onClick={() => setPreviewImageUrl(null)}
          >
            <div
              className="relative w-full"
              style={{ maxWidth: "min(90vw, 520px)" }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="absolute right-3 top-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label={tx.ariaClose}
                title={tx.ariaClose}
              >
                <X className="h-7 w-7" />
              </button>
              <img
                src={previewImageUrl}
                alt={tx.uploadPhotoUser}
                className="mx-auto h-auto w-auto max-w-full rounded-2xl border border-white/20 bg-white object-contain shadow-2xl"
                style={{ maxHeight: "calc(100vh - 8.5rem - env(safe-area-inset-top))" }}
              />
            </div>
          </div>
        )}
        </>
      )}
    </>
  );
}
