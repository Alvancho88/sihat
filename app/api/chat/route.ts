// app/api/chat/route.ts
// Epic 9: AI Conversational Health Assistant
// Uses Google Gemini API with Gemma 4 E4B (gemma-4-e4b-it)
// Supports context-aware advice from food scan sessionStorage data
// Supports multi-language: English, Bahasa Malaysia, Simplified Chinese

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface FoodItem {
  f: string;       // food name
  sugar: number;   // sugar in grams
  salt: number;    // sodium in mg
  fat: number;     // saturated fat in grams
  risk: "Low" | "Medium" | "High";
  tip?: string;
  best_reason?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  language?: "en" | "ms" | "zh";
  scanContext?: {
    "Appetizer"?: { ranking: FoodItem[] };
    "Main Dish"?: { ranking: FoodItem[] };
    "Dessert"?: { ranking: FoodItem[] };
    "Drinks"?: { ranking: FoodItem[] };
    uniqueFoodCount?: number;
  } | null;
}

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

// ─── SYSTEM PROMPT BUILDER ────────────────────────────────────────────────────

function buildSystemPrompt(
  language: string,
  scanContext: ChatRequest["scanContext"]
): string {
  const langInstructions: Record<string, string> = {
    en: "You must respond entirely in English.",
    ms: "Anda mesti menjawab sepenuhnya dalam Bahasa Malaysia.",
    zh: "你必须完全使用简体中文回答。",
  };

  const disclaimers: Record<string, string> = {
    en: "⚕️ This is general guidance only — please consult your doctor for personal medical advice.",
    ms: "⚕️ Ini adalah panduan umum sahaja — sila rujuk doktor anda untuk nasihat perubatan peribadi.",
    zh: "⚕️ 以上仅为一般性建议——如需个人医疗建议，请咨询您的医生。",
  };

  const langInstruction = langInstructions[language] ?? langInstructions["en"];
  const disclaimer = disclaimers[language] ?? disclaimers["en"];

  // Build food context from sessionStorage scan results
  let foodContext = "";
  if (scanContext) {
    const allItems: string[] = [];
    const categories = ["Appetizer", "Main Dish", "Dessert", "Drinks"] as const;

    for (const cat of categories) {
      const catData = scanContext[cat];
      if (catData?.ranking?.length) {
        for (const item of catData.ranking) {
          allItems.push(
            `- ${item.f} (Risk: ${item.risk}, Sugar: ${item.sugar}g, Sodium: ${item.salt}mg, Fat: ${item.fat}g)`
          );
        }
      }
    }

    if (allItems.length > 0) {
      foodContext = `
CURRENT FOOD SCAN CONTEXT (from user's menu analysis):
The user has just scanned a menu. Here are the analysed food items:
${allItems.join("\n")}

When the user asks about their food, refer to these specific items by name.
Always mention at least one food item name AND its risk level when scan data is available.
Recommend Low-risk items. For High-risk items, suggest practical modifications.
`;
    }
  }

  return `You are Siti, a friendly Malaysian health buddy specialising in diabetes, hypertension, and hyperlipidaemia (the "Three Highs") for elderly Malaysian users.

${langInstruction}

YOUR ROLE:
- Answer questions about diabetes, high blood pressure, and high cholesterol in simple, easy-to-understand language.
- Provide dietary guidance based on sugar, salt, and fat (the Three Highs framework).
- Help users understand their food choices and make healthier decisions.
- Keep responses SHORT: maximum 4 sentences. Be warm and encouraging.

${foodContext}

STRICT RULES (NEVER break these):
1. Do NOT provide medical diagnoses, treatment plans, or medication recommendations.
2. Do NOT suggest specific drug dosages or medical procedures.
3. STRICTLY limit responses to 2-3 sentences maximum. Under 50 words only.
4. Do NOT include any disclaimer in your response. The disclaimer is shown separately in the UI.
5. If the user asks about topics UNRELATED to diabetes, high blood pressure, high cholesterol, food nutrition, or the SIHAT website features, politely redirect them using warm Manglish. Say something like: "Alamak, that one I cannot help lah! 😊 I only know about diabetes, Three Highs, and Malaysian food choices. For other things, please ask your doctor! Anything about your food or health I can help ah?"
6. NEVER answer questions about: politics, entertainment, technology, recipes unrelated to health, financial advice, or any topic outside health and nutrition.

TONE & PERSONALITY:
- You are like a friendly Malaysian neighbour who happens to know a lot about health.
- Use light Manglish naturally — mix in words like "lah", "ah", "wah", "kan", "boleh", "jangan risau", "no worries one", "can try one".
- Example: "Wah, nasi lemak got quite high sugar lah! Can still eat, but maybe ask for less sambal ah."
- Example: "Jangan risau! This one still okay one, just eat less portion lah."
- BUT when explaining medical facts (e.g. what diabetes is, how GI works), switch to clear and simple English — no slang for the actual health information.
- Never force slang — use it naturally at the start or end of sentences.
- Always warm, encouraging, never scary.
`;
}

// ─── GEMINI API CALL ──────────────────────────────────────────────────────────

/**
 * Calls Google Gemini API with Gemma 4 E4B (gemma-4-e4b-it).
 * Uses REST endpoint directly — no SDK required, works in Next.js API routes.
 * Gemma 4 natively supports system_instruction role (unlike older Gemma versions).
 */
async function callGeminiChat(
  systemPrompt: string,
  messages: ChatMessage[],
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: systemPrompt },
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
      temperature: 0.4,
      max_tokens: 150,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Empty response from Groq");
  return text;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, history = [], language = "en", scanContext = null } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const primaryKey = process.env.GROQ_API_KEY_3;
    const backupKey = process.env.GROQ_API_KEY_4;

    if (!primaryKey && !backupKey) {
    throw new Error("No GEMINI API keys configured");
    }

    const systemPrompt = buildSystemPrompt(language, scanContext);

    // Keep last 6 messages for context efficiency
    const conversationMessages: ChatMessage[] = [
    ...history.slice(-6),
    { role: "user", content: message },
    ];

    let reply = "";
    try {
    if (!primaryKey) throw new Error("No primary key");
    reply = await callGeminiChat(systemPrompt, conversationMessages, primaryKey);
    console.log("[chat] ✅ Response OK (primary key)");
    } catch (err) {
    console.warn("[chat] ⚠️ Primary key failed, trying backup...", err);
    if (!backupKey) throw err;
    reply = await callGeminiChat(systemPrompt, conversationMessages, backupKey);
    console.log("[chat] ✅ Response OK (backup key)");
    }

    return NextResponse.json({ reply });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[chat] ❌ Error:", errMsg);

    // Fallback messages per language — return 200 so UI doesn't crash
    const fallbacks: Record<string, string> = {
      en: "Sorry, I'm unable to respond right now. Please try again in a moment.",
      ms: "Maaf, saya tidak dapat menjawab sekarang. Sila cuba lagi sebentar.",
      zh: "抱歉，我暂时无法回答。请稍后再试。",
    };

    // Try to get language from request body for correct fallback
    let lang = "en";
    try {
      const body = await req.json().catch(() => ({}));
      lang = (body as any)?.language ?? "en";
    } catch {}

    return NextResponse.json(
      { reply: fallbacks[lang] ?? fallbacks["en"] },
      { status: 200 }
    );
  }
}