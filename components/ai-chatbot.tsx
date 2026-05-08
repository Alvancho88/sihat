"use client";

// components/AIChatbot.tsx
// Epic 9: AI Conversational Health Assistant
// Features:
// - Floating button accessible from all pages
// - Context-aware: reads food scan results from sessionStorage
// - Multi-language: English, Bahasa Malaysia, Simplified Chinese
// - Safety: disclaimer on every message, no medical diagnosis
// - Fallback handling for API errors

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Loader2, ChevronDown, Plus, Check, Mic } from "lucide-react";
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
  risk: "Low" | "Medium" | "High";
  tip?: string;
  best_reason?: string;
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
    placeholder: "Ask about diabetes, food choices...",
    send: "Send",
    voiceStart: "Start voice input",
    voiceStop: "Stop listening",
    listening: "Listening...",
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
      "Is this food suitable for diabetes?",
      "What should I choose from my scanned menu?",
      "How is my daily food plan today?",
      "What foods should I limit for high blood pressure?",
      "What are the Three Highs?",
    ],
    languageSwitched: "From now on, I will reply in English.",
  },
  ms: {
    title: "Pembantu SIHAT",
    subtitle: "Tanya saya tentang diabetes & pemakanan",
    placeholder: "Tanya tentang diabetes, pilihan makanan...",
    send: "Hantar",
    voiceStart: "Mulakan input suara",
    voiceStop: "Berhenti mendengar",
    listening: "Sedang mendengar...",
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
      "Adakah makanan ini sesuai untuk diabetes?",
      "Apa yang patut saya pilih daripada menu yang diimbas?",
      "Bagaimana pelan makanan harian saya hari ini?",
      "Makanan apa yang perlu saya hadkan untuk tekanan darah tinggi?",
      "Apa itu Tiga Tinggi?",
    ],
    languageSwitched: "Mulai sekarang, saya akan menjawab dalam Bahasa Malaysia.",
  },
  zh: {
    title: "SIHAT 健康助手",
    subtitle: "询问关于糖尿病和饮食的问题",
    placeholder: "询问关于糖尿病、食物选择...",
    send: "发送",
    voiceStart: "开始语音输入",
    voiceStop: "停止聆听",
    listening: "正在聆听...",
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
      "这个食物适合糖尿病吗？",
      "我应该从扫描的菜单中选择什么？",
      "我今天的每日饮食计划怎么样？",
      "高血压应该限制哪些食物？",
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
    const raw = sessionStorage.getItem("sihat_scan_results");
    if (!raw) return null;
    return JSON.parse(raw) as ScanContext;
  } catch {
    return null;
  }
}

/** Generates a simple unique ID for messages */
const STORAGE_KEY = "sihat_assistant_messages";
const SUGGESTIONS_KEY = "sihat_assistant_suggested_questions";

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

function getSessionSuggestedQuestions(lang: LangCode): readonly string[] {
  const questions: readonly string[] = t[lang].suggestedQ;
  if (typeof window === "undefined") return questions.slice(0, 3);

  const key = `${SUGGESTIONS_KEY}_${lang}`;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      const valid = parsed.filter((question) => questions.includes(question));
      if (valid.length === 3) return valid;
    }

    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, 3);
    sessionStorage.setItem(key, JSON.stringify(selected));
    return selected;
  } catch {
    return questions.slice(0, 3);
  }
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function AIChatbot({ lang }: { lang: LangCode }) {
  const tx = t[lang] ?? t["en"];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scanContext, setScanContext] = useState<ScanContext | null>(null);
  const [hasInitialised, setHasInitialised] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<readonly string[]>(() => t[lang].suggestedQ.slice(0, 3));
  const [supportsVoiceInput, setSupportsVoiceInput] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useCart();

  const pathname = usePathname();
  const lastRequestedLangRef = useRef<LangCode>(lang);
  const lastUnavailableRequestRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

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
    setSuggestedQuestions(getSessionSuggestedQuestions(lang));
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    setSupportsVoiceInput(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));

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
    }
  }, [isOpen]);

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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      const repeatKey = normalizeRepeatKey(trimmed);

      if (lastUnavailableRequestRef.current === repeatKey) {
        const userMsg: Message = { role: "user", content: trimmed, id: uid() };
        setMessages((prev) => [
          ...prev,
          userMsg,
          { role: "assistant", content: tx.stillUnavailable, id: uid() },
        ]);
        setInput("");
        return;
      }

      const userMsg: Message = { role: "user", content: trimmed, id: uid() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
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
        const intakeSummary = buildDailyIntakeSummary(cart, gender, lang);
        const requestBody: ChatRequestBody = {
          message: trimmed,
          history: historyMessages,
          language: lang,
          scanContext: scanContext ?? null,
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
          { role: "assistant", content: reply, suggestions: data.suggestions, id: uid() },
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
    [addToCart, cart, clearCart, isLoading, lang, messages, removeFromCart, scanContext, tx]
  );

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleVoiceInput = useCallback(() => {
    if (typeof window === "undefined" || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      inputRef.current?.focus();
      return;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSupportsVoiceInput(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = getSpeechRecognitionLanguage(lang);
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcriptParts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i]?.isFinal) {
          transcriptParts.push(event.results[i][0]?.transcript.trim() ?? "");
        }
      }

      const transcript = transcriptParts.filter(Boolean).join(" ");
      if (transcript) {
        setInput((current) => {
          const separator = current.trim() ? " " : "";
          return `${current.trimEnd()}${separator}${transcript}`;
        });
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      inputRef.current?.focus();
    };

    recognition.onend = () => {
      setIsListening(false);
      inputRef.current?.focus();
    };

    recognitionRef.current = recognition;
    setIsListening(true);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      inputRef.current?.focus();
    }
  }, [isListening, isLoading, lang]);

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
          zIndex: 9999,
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
          {/* 透明背景 — 點擊關閉 */}
          <div
            // Start overlay BELOW the sticky navbar so users can still switch language / navigate
            // while the chatbot popup is open.
            className="fixed left-0 right-0 bottom-0 top-16 md:top-20 transition-opacity duration-200"
            style={{ zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed inset-x-4 sm:inset-x-auto sm:right-5 sm:w-[400px] md:w-[420px] flex flex-col rounded-xl overflow-hidden shadow-xl bg-white transition-opacity duration-200"
            style={{
              top: "calc(4.5rem + env(safe-area-inset-top))",
              bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
              border: "1.5px solid #0a7a74",
              zIndex: 9999,
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
            {scanContext && (
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
                    {msg.content}
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
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2" style={{ background: "linear-gradient(135deg, #0a7a74, #047a57)" }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#0a7a74" }} />
                  <span className="text-gray-500" style={{ fontSize: "16px" }}>{tx.thinking}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Suggested Questions ── */}
          {messages.length <= 2 && !isLoading && !input.trim() && (
            <div className="px-4 py-3 flex flex-col gap-2 bg-gray-50 border-t border-gray-100 shrink-0">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left px-4 py-3 rounded-xl transition-colors font-medium"
                  style={{ 
                    fontSize: "15px", 
                    background: "#f0faf9",
                    border: "none",
                    color: "#0a7a74",
                  }}
                >
                  → {q}
                </button>
              ))}
            </div>
          )}

          {/* ── Input Area ── */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tx.placeholder}
                rows={2}
                disabled={isLoading}
                className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2 text-gray-800 placeholder-gray-400 bg-gray-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors max-h-24 overflow-y-auto"
                style={{ fontSize: "18px", lineHeight: "1.45", outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#0a7a74"; e.target.style.boxShadow = "0 0 0 3px rgba(15,95,90,0.15)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                aria-label={tx.placeholder}
              />
              {supportsVoiceInput && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={isLoading}
                  className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  style={{
                    borderColor: isListening ? "#0a7a74" : "#d1d5db",
                    background: isListening ? "#ecfdf5" : "#f9fafb",
                    color: "#0a7a74",
                  }}
                  aria-label={isListening ? tx.voiceStop : tx.voiceStart}
                  aria-pressed={isListening}
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                style={{
                  background: input.trim() && !isLoading ? "linear-gradient(135deg, #0a7a74, #047a57)" : "#e5e7eb",
                  color: input.trim() && !isLoading ? "white" : "#9ca3af",
                }}
                aria-label={tx.send}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            {isListening && (
              <p className="mt-2 font-medium" style={{ fontSize: "14px", color: "#0a7a74" }}>
                {tx.listening}
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
