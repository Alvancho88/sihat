"use client";

// components/AIChatbot.tsx
// Epic 9: AI Conversational Health Assistant
// Features:
// - Floating button accessible from all pages
// - Context-aware: reads food scan results from sessionStorage
// - Multi-language: English, Bahasa Malaysia, Simplified Chinese
// - Safety: disclaimer on every message, no medical diagnosis
// - Fallback handling for API errors

import { Fragment, useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bot, X, Send, Loader2, ChevronDown, Plus, Check, Mic, ImagePlus } from "lucide-react";
import { useCart } from "@/components/cart-context";
import { buildDailyIntakeSummary, type Gender, type DailyIntakeSummary } from "@/lib/daily-intake-summary";
import type { FoodItem as CartFoodItem } from "@/lib/food-functions";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type LangCode = "en" | "ms" | "zh";

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

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

type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  kind?: "system";
  suggestions?: CartFoodItem[];
  quickReplies?: string[];
  starterQuestions?: readonly string[];
  actionButton?: {
    label: string;
    href: string;
  };
}

// Shape of what /api/predict stores — mirrors the API response
interface ScanContext {
  "Appetizer"?: { ranking: FoodItem[] };
  "Main Dish"?: { ranking: FoodItem[] };
  "Dessert"?: { ranking: FoodItem[] };
  "Drinks"?: { ranking: FoodItem[] };
  uniqueFoodCount?: number;
}

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
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  reply?: string;
  action?: {
    type: "add" | "remove" | "clear";
    food?: CartFoodItem;
  };
  suggestions?: CartFoodItem[];
  unavailableFoodName?: string;
  quickReplies?: string[];
}

type ChatRequestBody = {
  message: string;
  history: ChatMessage[];
  language: LangCode;
  scanContext: ScanContext | null;
  cart: CartFoodItem[];
  intakeSummary: DailyIntakeSummary;
}

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "SIHAT Assistant",
    subtitle: "Ask me about diabetes & diet",
    placeholder: "Ask about food...",
    send: "Send",
    voiceStart: "Start voice input",
    voiceStop: "Stop listening",
    listening: "Listening... Tap again to stop",
    voiceNoSpeech: "I couldn't hear clearly. Please try again.",
    scanFood: "Analyse my food photo",
    uploadFoodPhoto: "Upload food photo",
    imageUnsupported: "Image upload is not supported on this device.",
    uploadPhotoUser: "Food photo uploaded.",
    photoAnalysing: "Analysing your food photo...",
    photoFailed: "Sorry, I could not analyse this photo. Please try again.",
    noFoodDetected: "I could not detect food clearly. Please try another photo.",
    foundFoods: "I found these foods:",
    highNutrientSummary: "Some items may be high in fat or sodium.",
    openFullAnalysis: "Open Full Analysis",
    welcome:
      "Hello! I'm Siti, your SIHAT health assistant. Ask me about food choices, diabetes, or the Three Highs.",
    scanFound: "💡 I can see you've scanned a menu! Ask me about your food choices and I'll give you personalised advice.",
    noScan: "No food scan found. Try scanning a menu first for personalised advice!",
    thinking: "Thinking...",
    errorRetry: "Something went wrong. Please try again.",
    stillUnavailable: "Sorry, that food is not in our food list.",
    ariaOpen: "Open health assistant",
    ariaClose: "Close health assistant",
    suggestedQ: [
      "Analyse my food photo",
      "What foods are better for diabetes?",
      "What are the Three Highs?",
    ],
    languageSwitched: "From now on, I will reply in English.",
  },
  ms: {
    title: "Pembantu SIHAT",
    subtitle: "Tanya saya tentang diabetes & pemakanan",
    placeholder: "Tanya tentang makanan...",
    send: "Hantar",
    voiceStart: "Mulakan input suara",
    voiceStop: "Berhenti mendengar",
    listening: "Sedang mendengar... Tekan sekali lagi untuk berhenti",
    voiceNoSpeech: "Saya tidak dengar dengan jelas. Sila cuba lagi.",
    scanFood: "Analisis foto makanan saya",
    uploadFoodPhoto: "Muat naik foto makanan",
    imageUnsupported: "Muat naik imej tidak disokong pada peranti ini.",
    uploadPhotoUser: "Foto makanan dimuat naik.",
    photoAnalysing: "Sedang menganalisis foto makanan anda...",
    photoFailed: "Maaf, saya tidak dapat menganalisis foto ini. Sila cuba lagi.",
    noFoodDetected: "Saya tidak dapat mengesan makanan dengan jelas. Sila cuba foto lain.",
    foundFoods: "Saya menjumpai makanan ini:",
    highNutrientSummary: "Sesetengah item mungkin tinggi lemak atau natrium.",
    openFullAnalysis: "Buka Analisis Penuh",
    welcome:
      "Helo! Saya Siti, pembantu kesihatan SIHAT anda. Tanya saya tentang pilihan makanan, diabetes, atau Tiga Tinggi.",
    scanFound: "💡 Saya nampak anda telah mengimbas menu! Tanya saya tentang pilihan makanan anda untuk nasihat peribadi.",
    noScan: "Tiada imbasan makanan ditemui. Cuba imbas menu dahulu untuk nasihat peribadi!",
    thinking: "Sedang berfikir...",
    errorRetry: "Ada masalah. Sila cuba lagi.",
    stillUnavailable: "Maaf, makanan itu tidak ada dalam senarai makanan kami.",
    ariaOpen: "Buka pembantu kesihatan",
    ariaClose: "Tutup pembantu kesihatan",
    suggestedQ: [
      "Analisis foto makanan saya",
      "Makanan apa yang lebih baik untuk diabetes?",
      "Apa itu Tiga Tinggi?",
    ],
    languageSwitched: "Mulai sekarang, saya akan menjawab dalam Bahasa Malaysia.",
  },
  zh: {
    title: "SIHAT 健康助手",
    subtitle: "询问关于糖尿病和饮食的问题",
    placeholder: "询问食物选择...",
    send: "发送",
    voiceStart: "开始语音输入",
    voiceStop: "停止聆听",
    listening: "正在聆听... 再点一次即可停止",
    voiceNoSpeech: "我听不清楚，请再试一次。",
    scanFood: "分析我的食物照片",
    uploadFoodPhoto: "上传食物照片",
    imageUnsupported: "此设备不支持图片上传。",
    uploadPhotoUser: "已上传食物照片。",
    photoAnalysing: "正在分析您的食物照片...",
    photoFailed: "抱歉，我无法分析这张照片。请再试一次。",
    noFoodDetected: "我无法清楚识别食物。请换一张照片再试。",
    foundFoods: "我找到这些食物：",
    highNutrientSummary: "有些食物可能脂肪或钠含量较高。",
    openFullAnalysis: "打开完整分析",
    welcome:
      "您好！我是 Siti，您的 SIHAT 健康助手。您可以询问食物选择、糖尿病或三高相关问题。",
    scanFound: "💡 我看到您已扫描了菜单！向我询问您的食物选择，我将为您提供个性化建议。",
    noScan: "未找到食物扫描记录。请先扫描菜单以获取个性化建议！",
    thinking: "思考中...",
    errorRetry: "出现错误，请重试。",
    stillUnavailable: "抱歉，这个食物不在我们的食物列表中。",
    ariaOpen: "打开健康助手",
    ariaClose: "关闭健康助手",
    suggestedQ: [
      "分析我的食物照片",
      "哪些食物比较适合糖尿病？",
      "什么是三高？",
    ],
    languageSwitched: "从现在开始，我将使用简体中文回答。",
  },
} as const;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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
const STORAGE_KEY = "sihat_assistant_messages";
const SCAN_CONTEXT_KEY = "sihat_scan_results";

function hasScanContextItems(ctx: ScanContext | null): boolean {
  if (!ctx) return false;
  return (["Appetizer", "Main Dish", "Dessert", "Drinks"] as const).some(
    (category) => Boolean(ctx[category]?.ranking?.length)
  );
}

function getScanFoodItems(ctx: ScanContext | null): FoodItem[] {
  if (!ctx) return [];
  return (["Appetizer", "Main Dish", "Dessert", "Drinks"] as const).flatMap(
    (category) => ctx[category]?.ranking ?? []
  );
}

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

function hasHighFatOrSodium(ctx: ScanContext | null): boolean {
  return getScanFoodItems(ctx).some((item) => item.fat > 7 || item.salt > 600 || item.risk === "High");
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

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

function readGenderPreference(): Gender {
  if (typeof window === "undefined") return "male";
  return localStorage.getItem("manis-gender") === "female" ? "female" : "male";
}

function normalizeRepeatKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getCartFoodName(food: CartFoodItem, lang: LangCode): string {
  return food.name[lang] || food.name.en;
}

function getSpeechRecognitionLanguage(lang: LangCode): string {
  if (lang === "ms") return "ms-MY";
  if (lang === "zh") return "zh-CN";
  return "en-US";
}

function normalizeLanguageText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

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

function getUserMessageLanguage(message: string, fallback: LangCode): LangCode {
  return detectUserMessageLanguage(message) ?? fallback;
}

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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function AIChatbot({ lang }: { lang: LangCode }) {
  const tx = t[lang] ?? t["en"];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPhotoAnalyzing, setIsPhotoAnalyzing] = useState(false);
  const [scanContext, setScanContext] = useState<ScanContext | null>(null);
  const [hasInitialised, setHasInitialised] = useState(false);
  const [supportsVoiceInput, setSupportsVoiceInput] = useState(false);
  const [supportsImageUpload, setSupportsImageUpload] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useCart();

  const pathname = usePathname();
  const router = useRouter();
  const lastRequestedLangRef = useRef<LangCode>(lang);
  const conversationLangRef = useRef<LangCode>(lang);
  const lastUnavailableRequestRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const pendingVoiceTranscriptRef = useRef("");
  const lastScanContextRawRef = useRef<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Ensure chat reopens at the latest message before rendering
  useLayoutEffect(() => {
    if (!isOpen || messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [isOpen, messages.length]);

  // Close chatbot on route change while preserving session history
  useEffect(() => {
    if (!isOpen) return;
    setIsOpen(false);
  }, [pathname]);

  // Restore chat history for the current browser session
  useEffect(() => {
    const storedMessages = readMessageHistory();
    if (storedMessages?.length) {
      setMessages(storedMessages);
      setHasInitialised(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    setSupportsVoiceInput(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    setSupportsImageUpload(Boolean(window.FormData && window.File && window.FileReader));

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
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

      const msgs: Message[] = [welcomeMsg];

      // If scan context found, add a hint message
      if (ctx) {
        msgs.push({
          role: "assistant",
          content: tx.scanFound,
          id: uid(),
        });
      }

      setMessages(msgs);
      setHasInitialised(true);

      // Focus input after open animation
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, hasInitialised, tx]);

  // Re-read scan context when chat opens (user may have just scanned)
  useEffect(() => {
    if (isOpen) {
      const ctx = readScanContext();
      setScanContext(ctx);
      lastScanContextRawRef.current = typeof window === "undefined" ? null : sessionStorage.getItem(SCAN_CONTEXT_KEY);
    }
  }, [isOpen]);

  // Keep chatbot scan context in sync with the recommendation page's session storage.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncScanContext = () => {
      const raw = sessionStorage.getItem(SCAN_CONTEXT_KEY);
      if (raw === lastScanContextRawRef.current) return;
      lastScanContextRawRef.current = raw;
      setScanContext(readScanContext());
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
      sessionStorage.removeItem(SCAN_CONTEXT_KEY);
      lastScanContextRawRef.current = null;
      setScanContext(null);
    };

    syncScanContext();
    window.addEventListener("storage", handleStorage);
    document.addEventListener("click", handleRecommendationResetClick, true);

    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("click", handleRecommendationResetClick, true);
    };
  }, [pathname]);

  // Add a minimal in-chat language switch indicator when language changes
  useEffect(() => {
    if (!isOpen || !hasInitialised) return;
    if (lastRequestedLangRef.current === lang) return;

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
  }, [lang, isOpen, hasInitialised, tx]);

  // ─── SEND MESSAGE ───────────────────────────────────────────────────────────

  const addSuggestedFood = useCallback(
    (food: CartFoodItem) => {
      const foodName = getCartFoodName(food, lang);
      const alreadyAdded = isInCart(food.name.en);

      if (!alreadyAdded) {
        addToCart(food);
      }

      const confirmText = {
        en: alreadyAdded
          ? `${foodName} is already in your daily plan.`
          : `${foodName} added to your daily plan.`,
        ms: alreadyAdded
          ? `${foodName} sudah ada dalam pelan harian anda.`
          : `${foodName} ditambah ke pelan harian anda.`,
        zh: alreadyAdded
          ? `${foodName} 已经在您的每日计划中了。`
          : `${foodName} 已添加到您的每日计划。`,
      };

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: confirmText[lang], id: uid() },
      ]);
      lastUnavailableRequestRef.current = null;
    },
    [addToCart, isInCart, lang]
  );

  const buildPhotoSummary = useCallback(
    (ctx: ScanContext): string => {
      const names = getScanFoodNames(ctx).slice(0, 5);
      const lines = [`${tx.foundFoods}`, ...names.map((name) => `• ${name}`)];
      if (hasHighFatOrSodium(ctx)) {
        lines.push("", tx.highNutrientSummary);
      }
      return lines.join("\n");
    },
    [tx.foundFoods, tx.highNutrientSummary]
  );

  const openFullAnalysis = useCallback((href: string) => {
    setIsOpen(false);
    router.push(href);
  }, [router]);

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || isLoading || isPhotoAnalyzing) return;

      if (!supportsImageUpload) {
        setMessages((prev) => [...prev, { role: "assistant", content: tx.imageUnsupported, id: uid() }]);
        return;
      }

      if (!file.type.startsWith("image/")) {
        setMessages((prev) => [...prev, { role: "assistant", content: tx.photoFailed, id: uid() }]);
        return;
      }

      const userMsg: Message = { role: "user", content: tx.uploadPhotoUser, id: uid() };
      setMessages((prev) => [...prev, userMsg]);
      setIsPhotoAnalyzing(true);
      setVoiceNotice("");

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", lang);

        const res = await fetch("/api/predict", { method: "POST", body: formData });
        if (!res.ok) {
          throw new Error("Prediction failed");
        }

        const data = (await res.json()) as ScanContext;
        if (!hasScanContextItems(data)) {
          sessionStorage.removeItem(SCAN_CONTEXT_KEY);
          lastScanContextRawRef.current = null;
          setScanContext(null);
          setMessages((prev) => [...prev, { role: "assistant", content: tx.noFoodDetected, id: uid() }]);
          return;
        }

        const raw = JSON.stringify(data);
        sessionStorage.setItem(SCAN_CONTEXT_KEY, raw);
        lastScanContextRawRef.current = raw;
        setScanContext(data);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: buildPhotoSummary(data),
            actionButton: { label: tx.openFullAnalysis, href: "/recommendation" },
            id: uid(),
          },
        ]);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: tx.photoFailed, id: uid() }]);
      } finally {
        setIsPhotoAnalyzing(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [
      buildPhotoSummary,
      isLoading,
      isPhotoAnalyzing,
      lang,
      supportsImageUpload,
      tx.imageUnsupported,
      tx.noFoodDetected,
      tx.openFullAnalysis,
      tx.photoFailed,
      tx.uploadPhotoUser,
    ]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || isPhotoAnalyzing) return;
      const repeatKey = normalizeRepeatKey(trimmed);
      const messageLang = getUserMessageLanguage(trimmed, lang);
      const shouldShowTypedLanguageSwitch = messageLang !== conversationLangRef.current;
      const typedLanguageSwitchMsg: Message | null = shouldShowTypedLanguageSwitch
        ? {
            role: "assistant",
            kind: "system",
            content: t[messageLang].languageSwitched,
            id: uid(),
          }
        : null;

      if (lastUnavailableRequestRef.current === repeatKey) {
        const userMsg: Message = { role: "user", content: trimmed, id: uid() };
        setMessages((prev) => [
          ...prev,
          userMsg,
          ...(typedLanguageSwitchMsg ? [typedLanguageSwitchMsg] : []),
          { role: "assistant", content: tx.stillUnavailable, id: uid() },
        ]);
        conversationLangRef.current = messageLang;
        setInput("");
        return;
      }

      const userMsg: Message = { role: "user", content: trimmed, id: uid() };
      const newMessages = typedLanguageSwitchMsg
        ? [...messages, userMsg, typedLanguageSwitchMsg]
        : [...messages, userMsg];
      setMessages(newMessages);
      conversationLangRef.current = messageLang;
      setInput("");
      setIsLoading(true);

      const historyMessages: ChatMessage[] = newMessages.slice(-6).map(({ role, content }) => ({ role, content }));
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
        const gender = readGenderPreference();
        const intakeSummary = buildDailyIntakeSummary(cart, gender, messageLang);
        const latestScanContext = readScanContext();
        setScanContext(latestScanContext);
        const requestBody: ChatRequestBody = {
          message: trimmed,
          history: historyMessages,
          language: messageLang,
          scanContext: latestScanContext,
          cart,
          intakeSummary,
        };

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const data = (await res.json()) as ChatResponse;
        const reply = data.reply || tx.errorRetry;

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

        if (data.suggestions?.length || data.unavailableFoodName) {
          lastUnavailableRequestRef.current = repeatKey;
        } else {
          lastUnavailableRequestRef.current = null;
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, suggestions: data.suggestions, quickReplies: data.quickReplies, id: uid() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: tx.errorRetry, id: uid() },
        ]);
      } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [addToCart, cart, clearCart, isLoading, isPhotoAnalyzing, lang, messages, removeFromCart, tx]
  );

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

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
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed right-6 w-16 h-16 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{
          background: "linear-gradient(135deg, #0a7a74 0%, #047a57 100%)",
          border: "2px solid #047a57",
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

      {/* ── Chat Window ── */}
      {isOpen && (
        <>
          <div
            // Keep the click-away layer below the navbar and its open language menu.
            className="fixed left-0 right-0 bottom-0 top-16 md:top-20 transition-opacity duration-200"
            style={{ zIndex: 60, pointerEvents: "none" }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed inset-x-4 sm:inset-x-auto sm:right-5 sm:w-[520px] lg:w-[560px] flex flex-col rounded-xl overflow-hidden shadow-xl bg-white transition-opacity duration-200"
            style={{
              top: "calc(4.5rem + env(safe-area-inset-top))",
              bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
              border: "1.5px solid #0a7a74",
              transform: "translateY(16px)",
              zIndex: 70,
            }}
            role="dialog"
            aria-label={tx.title}
          >
          {/* ── Header — teal green to stand out from the dark blue site ── */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-white shrink-0" style={{ background: "linear-gradient(135deg, #0a7a74 0%, #047a57 100%)" }}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base leading-tight">{tx.title}</p>
                <p className="text-sm text-white/80 leading-tight truncate">{tx.subtitle}</p>
              </div>
            </div>
            {hasScanContextItems(scanContext) && (
              <span className="hidden sm:inline-flex text-xs bg-white/20 text-white font-semibold px-2.5 py-1 rounded-full">
                {lang === "zh" ? "已扫描菜单" : lang === "ms" ? "Menu diimbas" : "Menu scanned"}
              </span>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="min-h-11 min-w-11 shrink-0 p-2 rounded-full hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={tx.ariaClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50" aria-live="polite" aria-atomic="false">
            {messages.map((msg) => (
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
                    className={`px-4 py-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "text-white rounded-tr-sm"
                        : msg.kind === "system"
                        ? "bg-gray-100 text-gray-700 border border-gray-200 rounded-tl-sm shadow-none italic"
                        : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm"
                    }`}
                    style={{
                      fontSize: msg.kind === "system" ? "15px" : "18px",
                      lineHeight: msg.kind === "system" ? "1.6" : "1.75",
                      ...(msg.role === "user" ? { background: "linear-gradient(135deg, #0a7a74, #047a57)" } : {}),
                    }}
                  >
                    {renderMessageContent(msg.content)}
                    {msg.role === "assistant" &&
                    msg.starterQuestions?.length &&
                    !messages.some((message) => message.role === "user") &&
                    !isLoading &&
                    !isPhotoAnalyzing &&
                    !input.trim() ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.starterQuestions.map((question) => (
                          <button
                            key={question}
                            type="button"
                            onClick={() => sendMessage(question)}
                            className="min-h-11 rounded-full border px-3.5 py-2 text-left font-semibold transition-colors hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            style={{
                              borderColor: "#99d3cf",
                              color: "#075f59",
                              background: "#f0faf9",
                              fontSize: "15px",
                              lineHeight: "1.35",
                            }}
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {msg.role === "assistant" && msg.suggestions?.length ? (
                    <div className="mt-2 flex flex-col gap-2">
                      {msg.suggestions.map((food) => {
                        const foodName = getCartFoodName(food, lang);
                        const alreadyAdded = isInCart(food.name.en);
                        return (
                          <button
                            key={food.name.en}
                            type="button"
                            onClick={() => addSuggestedFood(food)}
                            disabled={alreadyAdded}
                            className="w-full min-h-12 rounded-xl border-2 px-4 py-3 text-left font-bold shadow-sm transition-colors disabled:cursor-default disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            style={{
                              borderColor: alreadyAdded ? "#047a57" : "#0a7a74",
                              background: alreadyAdded ? "#ecfdf5" : "white",
                              color: "#064e3b",
                              fontSize: "18px",
                              lineHeight: "1.35",
                            }}
                          >
                            <span className="flex items-center gap-2">
                              {alreadyAdded ? <Check className="h-5 w-5 shrink-0" /> : <Plus className="h-5 w-5 shrink-0" />}
                              <span>{alreadyAdded ? foodName : `+ ${foodName}`}</span>
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
                  {msg.role === "assistant" && msg.actionButton ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => openFullAnalysis(msg.actionButton!.href)}
                        className="min-h-12 rounded-xl border-2 px-4 py-3 font-bold shadow-sm transition-colors text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        style={{
                          background: "linear-gradient(135deg, #0a7a74, #047a57)",
                          borderColor: "#047a57",
                          fontSize: "18px",
                          lineHeight: "1.35",
                        }}
                      >
                        {msg.actionButton.label}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {(isLoading || isPhotoAnalyzing) && (
              <div className="flex justify-start">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2" style={{ background: "linear-gradient(135deg, #0a7a74, #047a57)" }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#0a7a74" }} />
                  <span className="text-gray-500" style={{ fontSize: "16px" }}>
                    {isPhotoAnalyzing ? tx.photoAnalysing : tx.thinking}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Area ── */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              aria-label={tx.uploadFoodPhoto}
            />
            <div
              className="relative rounded-2xl border bg-gray-50 px-3 pt-2.5 pb-2 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
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
                placeholder={tx.placeholder}
                rows={2}
                disabled={isLoading || isPhotoAnalyzing}
                className="min-h-12 w-full resize-none border-0 bg-transparent px-1 py-0 pr-40 text-gray-800 placeholder-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed max-h-24 overflow-y-auto whitespace-nowrap"
                style={{ fontSize: "18px", lineHeight: "1.4", outline: "none" }}
                aria-label={tx.placeholder}
              />
              <div className="absolute bottom-1.5 right-2 flex items-center gap-1">
                {supportsImageUpload && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isLoading || isPhotoAnalyzing}
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
                  disabled={isLoading || isPhotoAnalyzing || !input.trim()}
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  style={{
                    background: input.trim() && !isLoading && !isPhotoAnalyzing ? "linear-gradient(135deg, #0a7a74, #047a57)" : "#e5e7eb",
                    color: input.trim() && !isLoading && !isPhotoAnalyzing ? "white" : "#6b7280",
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
                <span>{isListening ? tx.listening : voiceNotice}</span>
              </p>
            )}
          </div>

          {/* ── Fixed Disclaimer Bar ── */}
          <div className="px-4 py-3 shrink-0" style={{ background: "#ecfdf5", borderTop: "1.5px solid #6ee7b7" }}>
            <p className="text-center font-semibold" style={{ fontSize: "14px", color: "#064e3b" }}>
              🩺{" "}
              {lang === "zh"
                ? "以上仅为一般性建议——如需个人医疗建议，请咨询您的医生。"
                : lang === "ms"
                ? "Panduan umum sahaja — sila rujuk doktor anda untuk nasihat peribadi."
                : "General guidance only — please consult your doctor for personal medical advice."}
            </p>
          </div>
        </div>
        </>
      )}
    </>
  );
}
