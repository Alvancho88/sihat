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
import { Bot, X, Send, Loader2, ChevronDown, Plus, Check } from "lucide-react";
import { useCart } from "@/components/cart-context";
import { buildDailyIntakeSummary, type Gender, type DailyIntakeSummary } from "@/lib/daily-intake-summary";
import type { FoodItem as CartFoodItem } from "@/lib/food-functions";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type LangCode = "en" | "ms" | "zh";

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
    welcome:
      "Hello! 👋 I'm Siti, your SIHAT health buddy!\n\nI can help you with:\n• Is this food okay for my diabetes?\n• What foods should I avoid?\n• What are the Three Highs?\n\nJust type your question below lah! 😊",
    scanFound: "💡 I can see you've scanned a menu! Ask me about your food choices and I'll give you personalised advice.",
    noScan: "No food scan found. Try scanning a menu first for personalised advice!",
    thinking: "Thinking...",
    errorRetry: "Something went wrong. Please try again.",
    stillUnavailable: "Sorry, that food is not in our food list.",
    ariaOpen: "Open health assistant",
    ariaClose: "Close health assistant",
    suggestedQ: ["Is my food safe for diabetes?", "What should I avoid eating?", "Explain the Three Highs"],
    languageSwitched: "From now on, I will reply in English.",
  },
  ms: {
    title: "Pembantu SIHAT",
    subtitle: "Tanya saya tentang diabetes & pemakanan",
    placeholder: "Tanya tentang diabetes, pilihan makanan...",
    send: "Hantar",
    welcome:
      "Helo! 👋 Saya Siti, kawan kesihatan SIHAT anda!\n\nSaya boleh bantu anda dengan:\n• Adakah makanan ini selamat untuk diabetes saya?\n• Makanan apa yang perlu saya elakkan?\n• Apa itu Tiga Tinggi?\n\nTaip soalan anda di bawah ya! 😊",
    scanFound: "💡 Saya nampak anda telah mengimbas menu! Tanya saya tentang pilihan makanan anda untuk nasihat peribadi.",
    noScan: "Tiada imbasan makanan ditemui. Cuba imbas menu dahulu untuk nasihat peribadi!",
    thinking: "Sedang berfikir...",
    errorRetry: "Ada masalah. Sila cuba lagi.",
    stillUnavailable: "Maaf, makanan itu tidak ada dalam senarai makanan kami.",
    ariaOpen: "Buka pembantu kesihatan",
    ariaClose: "Tutup pembantu kesihatan",
    suggestedQ: ["Adakah makanan saya selamat untuk diabetes?", "Apa yang perlu saya elakkan?", "Terangkan Tiga Tinggi"],
    languageSwitched: "Mulai sekarang, saya akan menjawab dalam Bahasa Malaysia.",
  },
  zh: {
    title: "SIHAT 健康助手",
    subtitle: "询问关于糖尿病和饮食的问题",
    placeholder: "询问关于糖尿病、食物选择...",
    send: "发送",
    welcome:
      "你好！👋 我是Siti，您的SIHAT健康小助手！\n\n我可以帮您解答：\n• 这个食物对我的糖尿病安全吗？\n• 我应该避免哪些食物？\n• 什么是三高？\n\n请直接在下方输入您的问题吧！😊",
    scanFound: "💡 我看到您已扫描了菜单！向我询问您的食物选择，我将为您提供个性化建议。",
    noScan: "未找到食物扫描记录。请先扫描菜单以获取个性化建议！",
    thinking: "思考中...",
    errorRetry: "出现错误，请重试。",
    stillUnavailable: "抱歉，这个食物不在我们的食物列表中。",
    ariaOpen: "打开健康助手",
    ariaClose: "关闭健康助手",
    suggestedQ: ["我的食物对糖尿病安全吗？", "我应该避免什么食物？", "解释三高"],
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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function AIChatbot({ lang }: { lang: LangCode }) {
  const tx = t[lang] ?? t["en"];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scanContext, setScanContext] = useState<ScanContext | null>(null);
  const [hasInitialised, setHasInitialised] = useState(false);
  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useCart();

  const pathname = usePathname();
  const lastRequestedLangRef = useRef<LangCode>(lang);
  const lastUnavailableRequestRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
            className="fixed right-4 flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white transition-opacity duration-200"
            style={{
              width: "min(96vw, 520px)",
              // Keep the top edge away from the sticky navbar area
              // (navbar height is ~4rem on mobile and ~5rem on md+).
              height: "min(calc(100vh - 12rem), 720px)",
              border: "2px solid #0a7a74",
              zIndex: 9999,
              bottom: "calc(6rem + env(safe-area-inset-bottom))",
            }}
            role="dialog"
            aria-label={tx.title}
          >
          {/* ── Header — teal green to stand out from the dark blue site ── */}
          <div className="flex items-center justify-between px-5 py-4 text-white shrink-0" style={{ background: "linear-gradient(135deg, #0a7a74 0%, #047a57 100%)" }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-base leading-tight">{tx.title}</p>
                <p className="text-sm text-white/80 leading-tight">{tx.subtitle}</p>
              </div>
            </div>
            {scanContext && (
              <span className="text-xs bg-white/20 text-white font-semibold px-2.5 py-1 rounded-full mr-2">
                {lang === "zh" ? "已扫描菜单" : lang === "ms" ? "Menu diimbas" : "Menu scanned"}
              </span>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
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
              {tx.suggestedQ.map((q) => (
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
                className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-gray-800 placeholder-gray-400 bg-gray-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors max-h-28 overflow-y-auto"
                style={{ fontSize: "18px", lineHeight: "1.75", outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#0a7a74"; e.target.style.boxShadow = "0 0 0 3px rgba(15,95,90,0.15)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                aria-label={tx.placeholder}
              />
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
