// app/api/predict/route.ts
// Backend API endpoint for food analysis and recommendation system
// Uses Groq AI models: Llama-4-Scout for OCR backup and openai/gpt-oss-120b for nutritional analysis (trilingual en/ms/zh)
// Returns trilingual results (en/ms/zh) in a single response so the frontend can
// switch languages without re-calling the API.

import { NextRequest, NextResponse } from "next/server";
import { getAllFoodData, type FoodDataRow } from "@/lib/queries";

export const maxDuration = 60; // Maximum execution time for the API route (60 seconds)

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────────────

/**
 * Converts various input types to numbers for nutritional data processing
 */
function cleanToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const n = cleaned.includes(".") ? parseFloat(cleaned) : parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Safely parses JSON responses from AI models that might include markdown formatting
 */
function safeParseJson(raw: string): Record<string, unknown[]> {
  const stripped = raw.replace(/```json\s*|```/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(stripped.slice(start, i + 1));
    }
  }
  return JSON.parse(stripped);
}

/**
 * Extracts food and drink items from OCR content
 */
function parseItemsFromOcrContent(rawContent: string): string[] {
  if (!rawContent || typeof rawContent !== "string") return [];
  const trimmed = rawContent.trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray((parsed as any).items)) return (parsed as any).items;
  } catch (e) {}

  const jsonMatch = trimmed.match(/\{[\s\S]*"items"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray((parsed as any).items)) return (parsed as any).items;
    } catch (e) {}
  }

  return trimmed
    .split(/[,\n]/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((s) => s.length > 1 && s.length < 100);
}

/**
 * Removes duplicate items from an array while preserving order
 */
function deduplicateItems(items: string[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = item.toLowerCase().trim().replace(/\s+/g, " ");
    if (!seen.has(key)) seen.set(key, item.trim());
  }
  return Array.from(seen.values());
}

// ─── DATABASE FOOD LOOKUP ──────────────────────────────────────────────────────
// Mirrors the approach in app/api/chat/route.ts: fetch all food rows, build a
// map keyed by food_id, then match predict items against DB names.

type DbFood = {
  food_id: number;
  sugar: number | null;
  fat: number | null;
  sodium: number | null;
  calories: number | null;
  gi_value: number | null;
  food_type: string | null;
  serving_size: string | null;
  names: string[]; // all translated names (en/ms/zh)
};

function buildDbFoodMap(rows: FoodDataRow[]): DbFood[] {
  const byId = new Map<number, DbFood>();
  for (const row of rows) {
    if (row.food_id === null) continue;
    if (!byId.has(row.food_id)) {
      byId.set(row.food_id, {
        food_id: row.food_id,
        sugar: row.sugar ?? null,
        fat: row.fat ?? null,
        sodium: row.sodium ?? null,
        calories: row.calories ?? null,
        gi_value: row.gi_value ?? null,
        food_type: row.food_type ?? null,
        serving_size: row.serving_size ?? null,
        names: [],
      });
    }
    const entry = byId.get(row.food_id)!;
    if (row.food_name) entry.names.push(row.food_name);
  }
  return Array.from(byId.values());
}

/** "f" must be a food name string — LLM sometimes returns numeric salt/sugar values by mistake. */
function coerceFoodNameField(raw: unknown): string {
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s && !/^\d+(\.\d+)?$/.test(s)) return s;
    return "";
  }
  if (typeof raw === "number") return "";
  const s = String(raw ?? "").trim();
  if (!s || /^\d+(\.\d+)?$/.test(s)) return "";
  return s;
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshteinDist(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Finds the best matching DB food entry for a given food name.
 * Returns null if no confident match found.
 * Strategy: exact → token-prefix → fuzzy (≥0.82 similarity).
 */
function matchFoodInDb(foodName: string, dbFoods: DbFood[]): DbFood | null {
  const query = normalizeForMatch(foodName);
  const queryCompact = query.replace(/\s+/g, "");
  if (!query) return null;

  // Build candidate list: (dbFood, normalizedName, compactName)
  type Candidate = { food: DbFood; norm: string; compact: string };
  const candidates: Candidate[] = dbFoods.flatMap((food) =>
    food.names.map((name) => ({
      food,
      norm: normalizeForMatch(name),
      compact: normalizeForMatch(name).replace(/\s+/g, ""),
    }))
  );

  // 1. Exact match
  const exact = candidates.filter((c) => c.norm === query || c.compact === queryCompact);
  if (exact.length > 0) return exact[0].food;

  // 2. Token-prefix: query tokens are a prefix of the DB name tokens
  const queryTokens = query.split(" ").filter(Boolean);
  const prefixMatches = candidates.filter((c) => {
    const nameTokens = c.norm.split(" ").filter(Boolean);
    if (queryTokens.length > nameTokens.length) return false;
    return queryTokens.every((t, i) => nameTokens[i] === t);
  });
  if (prefixMatches.length === 1) return prefixMatches[0].food;
  if (prefixMatches.length > 1) {
    // Pick shortest name (most specific match)
    return prefixMatches.sort((a, b) => a.norm.length - b.norm.length)[0].food;
  }

  // 3. Fuzzy match — use Levenshtein similarity
  const maxLen = Math.max(1, queryCompact.length);
  const scored = candidates
    .map((c) => ({
      food: c.food,
      score: 1 - levenshteinDist(queryCompact, c.compact) / Math.max(queryCompact.length, c.compact.length),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score >= 0.82) {
    return scored[0].food;
  }

  return null;
}

/**
 * Merges DB nutritional values into an LLM-generated item.
 * DB values take priority; missing DB fields fall back to LLM-generated values.
 */
function mergeWithDbValues(
  item: Record<string, any>,
  dbFood: DbFood
): Record<string, any> {
  return {
    ...item,
    sugar: dbFood.sugar ?? item.sugar,
    salt: dbFood.sodium ?? item.salt,
    fat: dbFood.fat ?? item.fat,
    ...(dbFood.calories != null ? { calories: dbFood.calories } : {}),
    ...(dbFood.gi_value != null ? { gi: dbFood.gi_value } : {}),
    _db_matched: true,
  };
}

// ─── FOOD NAME NORMALIZATION ──────────────────────────────────────────────────────
/**
 * Normalizes food names for consistent spelling and special cases.
 * 1. Fuzzy-corrects common misspellings (e.g. "char kuey teow" → "Char Kway Teow")
 * 2. Maps special cases to database-friendly names (e.g. "Hainanese Chicken Rice" → "Chicken Rice")
 */
function normalizeFoodItemName(name: string): string {
  const n = name.trim();

  // ── Special case: Hainanese Chicken Rice → Chicken Rice (database match) ──
  if (/hainanese\s+chicken\s+rice/i.test(n)) {
    return "Chicken Rice";
  }

  // ── Spelling correction: char kway teow variants ──
  // Catches: char kuey teow, char kwey teow, char koay teow, cha kway teow, etc.
  if (/ch[ae]r?\s+k[uo][ae][wy]?\s+te[ao]w/i.test(n)) {
    return "Char Kway Teow";
  }

  return n;
}

/**
 * Applies food name normalization to an array of items.
 */
function normalizeFoodItemNames(items: string[]): string[] {
  return items.map(normalizeFoodItemName);
}

// ─── OCR PROCESSING WITH OPENROUTER (Gemma 4 31B) ───────────────────────
/**
 * OCR processing using Gemma 4 31B via Google AI Studio.
 * Extracts menu items from an image using vision-language capabilities.
 */
// ─── OCR PROCESSING WITH OPENROUTER (Gemma 4 31B) ───────────────────────
async function executeGemma4OcrRequest(apiKey: string, base64: string, mimeType: string) {
  if (!apiKey) throw new Error("Google AI Studio API key is undefined or empty");

  let cleanMime = mimeType.toLowerCase().trim();
  if (cleanMime === "image/jpg") cleanMime = "image/jpeg";

  const modelName = "gemma-4-31b-it";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `You are a menu analysis engine. Check if the image is food image or menu image.

A. If the image is a food image:
DETECTION STRATEGY (Adaptive):
1. Return Food name you detected
2. IGNORE The Food Ingredients (Return ["Satay"] not ["Satay", "Peanut Sauce", "Ketupat", "Cucumber", "Red  Onion"])

B. If the image is a menu image:
DETECTION STRATEGY (Adaptive):
1. IF PRICES EXIST: Use prices or codes (A1, RM10) as anchors to identify valid items.
2. IF NO PRICES EXIST: Identify items based on list structure (columns, bullets, or photos).
3. HIERARCHY RULE: IGNORE large category headers (e.g., "NASI GORENG"). Only extract specific sub-items.
4. DECORATION RULE: Ignore generic background illustrations.

Formatting:
- Return ONLY valid JSON: {"items": ["Item 1", "Item 2"]}`
            },
            {
              inlineData: {
                mimeType: cleanMime,
                data: base64.replace(/^data:image\/\w+;base64,/, ""),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "string" } }
          },
          required: ["items"]
        }
      },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("[predict] Google AI Studio error:", JSON.stringify(errorData, null, 2));
    throw new Error(errorData?.error?.message || `Google OCR error ${res.status}`);
  }

  return await res.json();
}

// ─── OCR BACKUP: Llama-4-Scout via Groq ──────────────────────────────────
async function executeLlama4ScoutOcrRequest(groqApiKey: string, base64: string, mimeType: string) {
  if (!groqApiKey) throw new Error("Groq API key is undefined or empty");

  let cleanMime = mimeType.toLowerCase().trim();
  if (cleanMime === "image/jpg") cleanMime = "image/jpeg";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a menu analysis engine. Check if the image is food image or menu image.

A. If the image is a food image:
DETECTION STRATEGY (Adaptive):
1. Return Food name you detected
2. IGNORE The Food Ingredients (Return ["Satay"] not ["Satay", "Peanut Sauce", "Ketupat", "Cucumber", "Red  Onion"])

B. If the image is a menu image:
DETECTION STRATEGY (Adaptive):
1. IF PRICES EXIST: Use prices or codes (A1, RM10) as anchors to identify valid items.
2. IF NO PRICES EXIST: Identify items based on list structure (columns, bullets, or photos).
3. HIERARCHY RULE: IGNORE large category headers (e.g., "NASI GORENG"). Only extract specific sub-items.
4. DECORATION RULE: Ignore generic background illustrations.

Formatting:
- Return ONLY valid JSON: {"items": ["Item 1", "Item 2"]}`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${cleanMime};base64,${base64.replace(/^data:image\/\w+;base64,/, "")}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("[predict] Groq Llama-4-Scout OCR error:", JSON.stringify(errorData, null, 2));
    throw new Error(errorData?.error?.message || `Groq OCR error ${res.status}`);
  }

  return await res.json();
}

async function processSingleImage(arrayBuffer: ArrayBuffer, mimeType: string): Promise<string[]> {
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const googleKey1 = process.env.GOOGLE_API_KEY;
  const googleKey2 = process.env.GOOGLE_API_KEY_2;
  const googleKey3 = process.env.GOOGLE_API_KEY_3;
  const googleKey4 = process.env.GOOGLE_API_KEY_4;
  const groqKey = process.env.GROQ_API_KEY;

  if (!googleKey1 && !googleKey2 && !googleKey3 && !googleKey4 && !groqKey) return [];

  const tryWithGoogleKey = async (apiKey: string) => {
    const ocrResult = await executeGemma4OcrRequest(apiKey, base64, mimeType);
    const rawContent = ocrResult?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = parseItemsFromOcrContent(rawContent);
    return normalizeFoodItemNames(deduplicateItems(parsed));
  };

  const tryWithLlama4Scout = async () => {
    if (!groqKey) throw new Error("Groq API key missing for OCR backup");
    const ocrResult = await executeLlama4ScoutOcrRequest(groqKey, base64, mimeType);
    const rawContent = ocrResult?.choices?.[0]?.message?.content ?? "";
    const parsed = parseItemsFromOcrContent(rawContent);
    return normalizeFoodItemNames(deduplicateItems(parsed));
  };

  // 1. Try Google primary key (Gemma 4 31B)
  if (googleKey1) {
    try {
      const result = await tryWithGoogleKey(googleKey1);
      console.log("[predict] ✅ OCR succeeded (GOOGLE_API_KEY, Gemma 4 31B)");
      return result;
    } catch (err) {
      console.warn("[predict] ⚠️ OCR GOOGLE_API_KEY failed:", (err as any)?.message ?? err);
    }
  }

  // 2. Try Google backup key 2 (Gemma 4 31B)
  if (googleKey2) {
    try {
      const result = await tryWithGoogleKey(googleKey2);
      console.log("[predict] ✅ OCR succeeded (GOOGLE_API_KEY_2, Gemma 4 31B)");
      return result;
    } catch (err) {
      console.warn("[predict] ⚠️ OCR GOOGLE_API_KEY_2 failed:", (err as any)?.message ?? err);
    }
  }

  // 3. Try Google backup key 3 (Gemma 4 31B)
  if (googleKey3) {
    try {
      const result = await tryWithGoogleKey(googleKey3);
      console.log("[predict] ✅ OCR succeeded (GOOGLE_API_KEY_3, Gemma 4 31B)");
      return result;
    } catch (err) {
      console.warn("[predict] ⚠️ OCR GOOGLE_API_KEY_3 failed:", (err as any)?.message ?? err);
    }
  }

  // 4. Try Google backup key 4 (Gemma 4 31B)
  if (googleKey4) {
    try {
      const result = await tryWithGoogleKey(googleKey4);
      console.log("[predict] ✅ OCR succeeded (GOOGLE_API_KEY_4, Gemma 4 31B)");
      return result;
    } catch (err) {
      console.warn("[predict] ⚠️ OCR GOOGLE_API_KEY_4 failed:", (err as any)?.message ?? err);
    }
  }

  // 5. Last resort: Llama-4-Scout via Groq
  try {
    const result = await tryWithLlama4Scout();
    console.log("[predict] ✅ OCR succeeded (GROQ_API_KEY backup, Llama-4-Scout 17B)");
    return result;
  } catch (err) {
    console.error("[predict] ❌ All OCR attempts failed:", (err as any)?.message ?? err);
    return [];
  }
}

// ─── PROMPT BUILDERS ──────────────────────────────────────────────────────────────

/**
 * Builds the trilingual analysis prompt.
 *
 * The key change from the single-language version: instead of asking for one
 * language, we ask the model to return tip and best_reason as an object with
 * three keys — en, ms, zh — so the frontend can switch languages without
 * making another API call.
 *
 * Analysis uses openai/gpt-oss-120b (Groq) for all three locales in one response.
 */
const TOP_RANKED_PER_CATEGORY = 5;

function buildAnalysisPrompt(combinedOcr: string, userText: string, itemList?: string[]): string {
  const allItems = itemList && itemList.length > 0
    ? itemList
    : [
        ...combinedOcr.split("\n").map((s: string) => s.trim()).filter(Boolean),
        ...userText.split(",").map((s: string) => s.trim()).filter(Boolean),
      ];

  const numberedChecklist = allItems.map((item: string, i: number) => `${i + 1}. ${item}`).join("\n");
  const expectedCount = allItems.length;

  return `Nutrition API. Output ONE JSON object only. No markdown.

Categorize ALL ${expectedCount} items below, but in each category's "ranking" array include ONLY the top ${TOP_RANKED_PER_CATEGORY} healthiest items (Low→Medium→High risk; ties: salt, sugar, fat ascending). Omit lower-ranked items from output.

Items:
${numberedChecklist}

Rules:
- Categories: Appetizer | Main Dish | Dessert | Drinks (beverages in cups/glasses = Drinks)
- - Per ranked item: f (MUST be exact food name string from list — NEVER a number), sugar(g), salt(mg), fat(g), risk (Low/Medium/High), tip:{"en","ms","zh"} (advice to reduce salt/sugar/fat, max 8 words each)
- Risk: High if sugar>15 OR salt>600 OR fat>15; Medium if any 6-15g / 201-600mg / 6-15g; else Low
- Max ${TOP_RANKED_PER_CATEGORY} items per category ranking array
- best_reason on rank #1 per category only — (Why this item is the best choice, it has the lowest sugar for example)
- Each non-empty category: alternative_suggestion (food NOT in list) with f, sugar, salt, fat, risk, tip, reason (trilingual, max 8 words each)
- Normalize: Char Kway Teow variants → "Char Kway Teow"; Hainanese Chicken Rice → "Chicken Rice"
- uniqueFoodCount: ${expectedCount} (total items scanned, not items in ranking arrays)

Shape:
{"Appetizer":{"ranking":[],"all_high_risk":false,"alternative_suggestion":{...}},"Main Dish":{...},"Dessert":{...},"Drinks":{...},"uniqueFoodCount":${expectedCount}}`;
}

// ─── NUTRITIONAL ANALYSIS WITH GROQ (GPT-OSS 120B, trilingual en/ms/zh) ───────────

const GROQ_ANALYSIS_MODEL = "openai/gpt-oss-120b";
/** Groq on_demand tier caps prompt + max_tokens at 8000 per request. */
const GROQ_TPM_BUDGET = 8000;
const GROQ_ANALYSIS_MAX_TOKENS = 7300;

async function analyzeWithGptOss(
  combinedOcr: string,
  userText: string,
  apiKey: string | undefined,
  itemList?: string[],
): Promise<string> {
  if (!apiKey) throw new Error("API Key missing");

  const prompt = buildAnalysisPrompt(combinedOcr, userText, itemList);

  // Groq on_demand rejects when prompt_tokens + max_tokens exceeds ~8000
  const estimatedPromptTokens = Math.ceil(prompt.length / 3.5);
  const maxTokens = Math.min(
    GROQ_ANALYSIS_MAX_TOKENS,
    Math.max(2000, GROQ_TPM_BUDGET - 200 - estimatedPromptTokens),
  );

  console.log(`[predict] Using model: ${GROQ_ANALYSIS_MODEL} (trilingual en/ms/zh, max_tokens=${maxTokens}, est_prompt≈${estimatedPromptTokens})`);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: "Output valid JSON only. tip, best_reason, reason: {en, ms, zh}, max 8 words each.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
      // gpt-oss-120b: omit response_format (stricter JSON validation on Groq)
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq GPT-OSS analysis error ${res.status}: ${err}`);
  }

  const data = await res.json();

  // ── TRUNCATION DETECTION ──────────────────────────────────────────────────
  const choice = data?.choices?.[0];
  const finishReason = choice?.finish_reason ?? "unknown";
  const usage = data?.usage ?? {};
  const rawContent = choice?.message?.content ?? "{}";

  console.log(`[predict] 📊 Model response stats (${GROQ_ANALYSIS_MODEL}):`);
  console.log(`[predict]   finish_reason   : ${finishReason}`);
  console.log(`[predict]   prompt_tokens   : ${usage.prompt_tokens ?? "N/A"}`);
  console.log(`[predict]   completion_tokens: ${usage.completion_tokens ?? "N/A"}`);
  console.log(`[predict]   total_tokens    : ${usage.total_tokens ?? "N/A"}`);
  console.log(`[predict]   raw JSON length : ${rawContent.length} chars`);

  if (finishReason === "length") {
    console.error(`[predict] ❌ TRUNCATION DETECTED — finish_reason is "length". The model hit max_tokens (${maxTokens}) before completing the JSON.`);
    throw new Error(`GPT-OSS response truncated at ${maxTokens} completion tokens`);
  } else if (finishReason === "stop") {
    console.log(`[predict] ✅ Model finished normally (finish_reason: stop).`);
  } else {
    console.warn(`[predict] ⚠️ Unexpected finish_reason: "${finishReason}"`);
  }

  if (!rawContent.trim()) {
    throw new Error("GPT-OSS returned empty analysis content");
  }
  // ─────────────────────────────────────────────────────────────────────────

  return rawContent;
}

async function analyzeWithFallback(
  combinedOcr: string,
  userText: string,
  itemList?: string[],
): Promise<string> {
  const expectedCount = itemList?.length ?? 0;

  // Helper: count how many items the LLM actually returned across all categories
  function countReturnedItems(rawJson: string): number {
    try {
      const parsed = safeParseJson(rawJson);
      let total = 0;
      for (const cat of ["Appetizer", "Main Dish", "Dessert", "Drinks"]) {
        const catData = parsed[cat] as any;
        const items = Array.isArray(catData) ? catData : (catData?.ranking ?? []);
        total += (items as any[]).length;
      }
      return total;
    } catch {
      return 0;
    }
  }

  // Helper: attempt analysis — accept top-N-per-category output (not every scanned item)
  async function attemptAnalysis(fn: () => Promise<string>, label: string): Promise<string | null> {
    try {
      const result = await fn();
      const got = countReturnedItems(result);
      console.log(`[predict] ✅ Analysis succeeded (${label})`);
      console.log(`[predict] 🔢 Ranked items returned: ${got} (scanned ${expectedCount}, max ${TOP_RANKED_PER_CATEGORY} per category)`);
      if (got === 0) {
        console.warn(`[predict] ⚠️ EMPTY: ${label} returned no ranked items. Will try next option.`);
        return null;
      }
      return result;
    } catch (err) {
      console.warn(`[predict] ⚠️ ${label} failed: ${err}`);
      return null;
    }
  }

  // Try each key in order (same model): GROQ_API_KEY → _2 → _5 → _6
  const groqKey6 = process.env.GROQ_API_KEY_6 ?? process.env.GROQ_API_KEY6;
  const groqKeyAttempts: { env: string | undefined; label: string }[] = [
    { env: process.env.GROQ_API_KEY, label: "GROQ_API_KEY" },
    { env: process.env.GROQ_API_KEY_2, label: "GROQ_API_KEY_2" },
    { env: process.env.GROQ_API_KEY_5, label: "GROQ_API_KEY_5" },
    { env: groqKey6, label: "GROQ_API_KEY_6" },
  ];

  for (const { env, label } of groqKeyAttempts) {
    const result = await attemptAnalysis(
      () => analyzeWithGptOss(combinedOcr, userText, env, itemList),
      `${label}, ${GROQ_ANALYSIS_MODEL}`,
    );
    if (result) return result;
  }

  throw new Error("All analysis attempts failed or returned incomplete results");
}

// ─── RISK NORMALIZATION ────────────────────────────────────────────────────────────
// FIX: The AI sometimes returns "High Risk", "Low Risk", "Medium Risk" (with space)
// or lowercase variants. Normalise before mapping to avoid the bug where
// "High Risk" → unknown → default 2 (Medium) → High items rank above Low/Medium.

function normaliseRisk(raw: unknown): "Low" | "Medium" | "High" {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+risk$/, ""); // strip trailing " risk"
  if (s === "low") return "Low";
  if (s === "high") return "High";
  return "Medium"; // default to Medium for anything unknown
}

// ─── FALLBACK ALTERNATIVE SUGGESTIONS ────────────────────────────────────────────
// Used when the LLM detects all-high-risk but doesn't return an alternative_suggestion
// (e.g. when the model returns the old flat-array format).

const FALLBACK_ALTERNATIVES: Record<string, { f: string; sugar?: number; salt?: number; fat?: number; risk?: string; tip: { en: string; ms: string; zh: string }; reason: { en: string; ms: string; zh: string } }> = {
  "Main Dish": {
    f: "Steamed Fish with Vegetables",
    sugar: 2, salt: 180, fat: 4, risk: "Low",
    tip: {
      en: "A light steamed fish with vegetables is significantly lower in saturated fat and sodium than most Malaysian main dishes.",
      ms: "Ikan kukus dengan sayur-sayuran mengandungi lemak tepu dan natrium yang jauh lebih rendah berbanding kebanyakan hidangan utama Malaysia.",
      zh: "清蒸鱼配蔬菜的饱和脂肪和钠含量远低于大多数马来西亚主食。",
    },
    reason: {
      en: "All available main dishes are high risk. Steamed fish with vegetables is a healthier alternative with low saturated fat, low sodium, and no added sugar.",
      ms: "Semua hidangan utama yang tersedia berisiko tinggi. Ikan kukus dengan sayur-sayuran adalah alternatif yang lebih sihat dengan lemak tepu rendah, natrium rendah, dan tiada gula tambahan.",
      zh: "所有可选主菜均属高风险。清蒸鱼配蔬菜是更健康的选择，饱和脂肪低、钠含量低且无添加糖。",
    },
  },
  "Appetizer": {
    f: "Fresh Garden Salad",
    sugar: 3, salt: 80, fat: 2, risk: "Low",
    tip: {
      en: "A fresh garden salad with light dressing is very low in sugar, salt, and fat — a great starter for managing the three highs.",
      ms: "Salad taman segar dengan sos ringan sangat rendah gula, garam, dan lemak — pemula yang hebat untuk mengurus tiga tinggi.",
      zh: "配清淡酱汁的新鲜蔬菜沙拉糖分、盐分和脂肪含量极低，是控制三高的极佳开胃选择。",
    },
    reason: {
      en: "All appetizers detected are high risk. A fresh garden salad is a low-sodium, low-sugar, low-fat alternative to start your meal safely.",
      ms: "Semua pembuka selera yang dikesan berisiko tinggi. Salad taman segar adalah alternatif rendah natrium, rendah gula, dan rendah lemak untuk memulakan makanan dengan selamat.",
      zh: "检测到的所有开胃菜均属高风险。新鲜蔬菜沙拉是低钠、低糖、低脂的替代品，可安全开始您的一餐。",
    },
  },
  "Dessert": {
    f: "Fresh Fruit Platter",
    sugar: 12, salt: 5, fat: 1, risk: "Medium",
    tip: {
      en: "A fresh fruit platter provides natural sweetness with fiber and vitamins, without the added sugar and fat of most desserts.",
      ms: "Pinggan buah-buahan segar menyediakan kemanisan semula jadi dengan serat dan vitamin, tanpa gula tambahan dan lemak kebanyakan pencuci mulut.",
      zh: "新鲜水果拼盘提供天然甜味、纤维和维生素，无需大多数甜点的添加糖和脂肪。",
    },
    reason: {
      en: "All desserts detected are high risk. A fresh fruit platter is a naturally sweet, low-fat, lower-sodium alternative to satisfy your sweet tooth.",
      ms: "Semua pencuci mulut yang dikesan berisiko tinggi. Pinggan buah-buahan segar adalah alternatif manis semula jadi, rendah lemak, dan rendah natrium.",
      zh: "检测到的所有甜点均属高风险。新鲜水果拼盘是天然甜味、低脂、低钠的替代选择，可满足您对甜食的渴望。",
    },
  },
  "Drinks": {
    f: "Plain Water / Mineral Water",
    sugar: 0, salt: 0, fat: 0, risk: "Low",
    tip: {
      en: "Plain water is the healthiest drink choice — zero sugar, zero sodium, and zero calories.",
      ms: "Air kosong adalah pilihan minuman paling sihat — sifar gula, sifar natrium, dan sifar kalori.",
      zh: "白开水是最健康的饮品选择——零糖、零钠、零卡路里。",
    },
    reason: {
      en: "All drinks detected are high risk. Plain or mineral water has no sugar, no sodium, and no saturated fat — the safest drink for managing blood sugar, blood pressure, and cholesterol.",
      ms: "Semua minuman yang dikesan berisiko tinggi. Air kosong atau air mineral tiada gula, natrium, dan lemak tepu — minuman paling selamat untuk mengurus gula darah, tekanan darah, dan kolesterol.",
      zh: "检测到的所有饮品均属高风险。白开水或矿泉水不含糖、钠和饱和脂肪，是管理血糖、血压和胆固醇的最安全饮品。",
    },
  },
};



/**
 * POST /api/predict
 * ─────────────────────────────────────────────────────────────────────────────
 * Main API handler for food image analysis and nutritional ranking.
 *
 * Request (multipart/form-data):
 *   file[]    — up to 5 food/menu images (JPEG/PNG)
 *   userText  — comma-separated food names typed by the user (optional)
 *   language  — "en" | "ms" | "zh" (accepted but unused; response is always trilingual)
 *
 * Pipeline:
 *   1. OCR  — each image is processed by Gemma 4 31B (Google AI Studio).
 *             Falls back to Llama-4-Scout (Groq) if Google keys fail.
 *   2. Merge — OCR items + userText are deduplicated and normalised.
 *   3. LLM analysis — openai/gpt-oss-120b (Groq; keys GROQ_API_KEY, _2, _5, _6) classifies each item into
 *             Appetizer / Main Dish / Dessert / Drinks, estimates Sugar/Sodium/Fat,
 *             assigns risk, and writes trilingual tips in a single JSON response.
 *   4. DB merge — matched items get verified nutrition values from the SIHAT DB.
 *   5. Ranking — items sorted Low→High risk, then Salt→Sugar→Fat ascending.
 *   6. Response — all items per category (ranked) + alternative_suggestion + all_high_risk flag.
 *
 * Response (JSON):
 *   { Appetizer, "Main Dish", Dessert, Drinks, uniqueFoodCount }
 *   Each category: { ranking: FoodItem[], all_high_risk: boolean, alternative_suggestion }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userText = (formData.get("userText") as string) ?? "";
    const files = formData.getAll("file") as File[];
    // language is still accepted but no longer drives the analysis —
    // we always return trilingual JSON. Kept for backwards compatibility.

    // Process all uploaded images with OCR (max 5 images)
    const ocrResults = await Promise.all(
      files.slice(0, 5).map(async (file) => {
        const buf = await file.arrayBuffer();
        return processSingleImage(buf, file.type || "image/jpeg");
      })
    );
    const combinedOcr = deduplicateItems(ocrResults.flat()).join("\n");

    // ── OCR SUMMARY LOG ───────────────────────────────────────────────────────
    const ocrItemsPerImage = ocrResults.map((items, i) => `  image[${i}]: ${items.length} items → [${items.join(", ")}]`);
    const totalOcrRaw = ocrResults.flat().length;
    const totalOcrDeduped = combinedOcr ? combinedOcr.split("\n").filter(Boolean).length : 0;
    console.log(`[predict] 📷 OCR complete — ${files.length} image(s) processed:`);
    ocrItemsPerImage.forEach(line => console.log(`[predict] ${line}`));
    console.log(`[predict]   Total raw items (before dedup): ${totalOcrRaw}`);
    console.log(`[predict]   Total items sent to LLM (after dedup): ${totalOcrDeduped}`);
    console.log(`[predict]   Combined OCR list:\n${combinedOcr || "(empty)"}`);
    // ─────────────────────────────────────────────────────────────────────────

    // Normalize user text items (spelling + special cases)
    const normalizedUserText = userText
      .split(",")
      .map((s) => normalizeFoodItemName(s.trim()))
      .filter(Boolean)
      .join(", ");

    // Build the explicit item list (OCR items + user text items, deduped)
    // This is passed to the prompt as a numbered checklist and used for count validation
    const ocrItemList = combinedOcr.split("\n").map(s => s.trim()).filter(Boolean);
    const userItemList = normalizedUserText.split(",").map(s => s.trim()).filter(Boolean);
    const fullItemList = deduplicateItems([...ocrItemList, ...userItemList]);
    console.log(`[predict] 📋 Full item list for LLM (${fullItemList.length} items): [${fullItemList.join(", ")}]`);

    // Perform trilingual nutritional analysis
    const rawJson = await analyzeWithFallback(combinedOcr, normalizedUserText, fullItemList);
    console.log(`[predict] 🔍 Raw LLM JSON:\n${rawJson.slice(0, 3000)}`);
    let rawData: Record<string, unknown[]>;
    try {
      rawData = safeParseJson(rawJson);
    } catch {
      rawData = JSON.parse(rawJson);
    }

    // ── LLM PARSE SUMMARY LOG ─────────────────────────────────────────────────
    const categories = ["Appetizer", "Main Dish", "Dessert", "Drinks"];
    let totalLlmItems = 0;
    for (const cat of categories) {
      const catData = rawData[cat];
      const items = (Array.isArray(catData) ? catData : (catData as any)?.ranking ?? []) as Record<string, any>[];
      totalLlmItems += items.length;
      console.log(`[predict] 🗂️  LLM returned ${items.length} item(s) for "${cat}": [${items.map((i: any) => i.f ?? "?").join(", ")}]`);
    }
    console.log(`[predict] 📦 Total items returned by LLM across all categories: ${totalLlmItems}`);
    console.log(`[predict]    uniqueFoodCount from LLM: ${(rawData as any).uniqueFoodCount ?? "N/A"} (top ${TOP_RANKED_PER_CATEGORY} ranked per category in response)`);
    if (totalLlmItems === 0) {
      console.warn(`[predict] ⚠️  No ranked items returned by LLM.`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Fetch DB food data for nutritional value merging ──────────────────────
    let dbFoods: DbFood[] = [];
    try {
      const rows = await getAllFoodData();
      dbFoods = buildDbFoodMap(rows);
      console.log(`[predict] ✅ DB loaded: ${dbFoods.length} food entries`);
    } catch (dbErr) {
      console.warn("[predict] ⚠️ DB fetch failed, using LLM values only:", (dbErr as any)?.message ?? dbErr);
    }

    // Risk level mapping — uses normalised strings now (fix for ranking bug)
    const riskMap: Record<string, number> = {
      "Low": 1,
      "Medium": 2,
      "High": 3,
    };

    const finalResults: Record<string, { ranking: unknown[]; all_high_risk?: boolean; alternative_suggestion?: unknown }> = {};

    // ── PER-CATEGORY PROCESSING ───────────────────────────────────────────────
    // For each food category:
    //   • Clean numeric fields (cleanToNumber handles "15g" → 15)
    //   • Look up the food in the SIHAT DB and override with verified values
    //   • Normalise the risk string (handles "High Risk", "high", etc.)
    //   • Sort by risk → salt → sugar → fat (ascending)
    //   • Keep only top 3 results per category
    //   • Normalise alternative_suggestion fields for frontend consumption
    for (const cat of ["Appetizer", "Main Dish", "Dessert", "Drinks"]) {
      // Support both old format (array) and new format (object with ranking key)
      const catData = rawData[cat];
      const rawItems = (Array.isArray(catData) ? catData : (catData as any)?.ranking ?? []) as Record<string, any>[];
      const items = rawItems.flatMap((item): Record<string, any>[] => {
        const f = coerceFoodNameField(item.f ?? item.name ?? item.food);
        if (!f) return [];
        return [{ ...item, f }];
      });
      if (rawItems.length > items.length) {
        console.warn(`[predict] ⚠️ Dropped ${rawItems.length - items.length} item(s) in "${cat}" with invalid food name (f was numeric or empty)`);
      }
      const allHighRiskFromLLM: boolean = !Array.isArray(catData) && (catData as any)?.all_high_risk === true;
      const alternativeSuggestionFromLLM = !Array.isArray(catData) ? (catData as any)?.alternative_suggestion ?? null : null;

      for (const item of items) {
        item.sugar = cleanToNumber(item.sugar ?? 0);
        item.salt = cleanToNumber(item.salt ?? 0);
        item.fat = cleanToNumber(item.fat ?? 0);

        // ── DB LOOKUP ─────────────────────────────────────────────────────────
        // matchFoodInDb() uses exact → token-prefix → fuzzy (Levenshtein ≥0.82)
        // matching so that slight name variations (e.g. "Chicken Rice" vs
        // "Nasi Ayam") still resolve to the correct DB entry.
        // DB values always take priority over LLM estimates for accuracy.
        // ── DB LOOKUP: override with verified nutritional values ────────────
        if (dbFoods.length > 0) {
          const dbMatch = matchFoodInDb(String(item.f ?? ""), dbFoods);
          if (dbMatch) {
            const merged = mergeWithDbValues(item, dbMatch);
            item.sugar = cleanToNumber(merged.sugar ?? item.sugar);
            item.salt = cleanToNumber(merged.salt ?? item.salt);
            item.fat = cleanToNumber(merged.fat ?? item.fat);
            if (merged.calories != null) item.calories = merged.calories;
            if (merged.gi != null) item.gi = merged.gi;
            item._db_matched = true;
            console.log(`[predict] 🗄️ DB match: "${item.f}" → sugar:${item.sugar}g salt:${item.salt}mg fat:${item.fat}g`);
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        // ── RECALCULATE RISK from actual nutrition values (after DB merge) ──
        // Never trust the LLM risk label after DB values may have changed
        // sugar/salt/fat. Recompute deterministically from thresholds.
        const rSugar = item.sugar as number;
        const rSalt  = item.salt  as number;
        const rFat   = item.fat   as number;
        let recalcRisk: "Low" | "Medium" | "High";
        if (rSugar > 15 || rSalt > 600 || rFat > 15) {
          recalcRisk = "High";
        } else if (rSugar > 5 || rSalt > 200 || rFat > 5) {
          recalcRisk = "Medium";
        } else {
          recalcRisk = "Low";
        }
        item.risk = recalcRisk;
        item.risk_score = riskMap[recalcRisk];
        // ─────────────────────────────────────────────────────────────────
      }

      // ── RANKING ──────────────────────────────────────────────────────────────
      // Primary: risk score (Low=1 → Medium=2 → High=3), healthiest first.
      // Tie-breakers (same risk band): Sugar → Salt → Fat (lower = better).
      const sorted = [...items].sort((a, b) => {
        if (a.risk_score !== b.risk_score) return a.risk_score - b.risk_score;
        if (a.sugar !== b.sugar) return a.sugar - b.sugar;
        if (a.salt  !== b.salt)  return a.salt  - b.salt;
        return a.fat - b.fat;
      });

      // At most 5 per category — frontend shows top 3 + “See more” for up to 2 extras
      const allSorted = sorted.slice(0, TOP_RANKED_PER_CATEGORY);

      // Determine if ALL items in this category are high risk (using top 3 as representative sample)
      const top3ForRiskCheck = allSorted.slice(0, 3);
      const allHighRisk = allHighRiskFromLLM || (top3ForRiskCheck.length > 0 && top3ForRiskCheck.every((item) => normaliseRisk(item.risk) === "High"));

      allSorted.forEach((item: any, idx: number) => {
        delete item.risk_score;
        // Promote _db_matched to clean field name, default false
        item.db_matched = item._db_matched === true;
        delete item._db_matched;

        // Ensure tip is always a trilingual object
        if (typeof item.tip === "string") {
          item.tip = { en: item.tip, ms: item.tip, zh: item.tip };
        } else if (!item.tip || typeof item.tip !== "object") {
          item.tip = { en: "", ms: "", zh: "" };
        }

        if (idx === 0) {
          // Ensure best_reason is always a trilingual object (only for rank #1)
          if (typeof item.best_reason === "string") {
            item.best_reason = { en: item.best_reason, ms: item.best_reason, zh: item.best_reason };
          } else if (!item.best_reason || typeof item.best_reason !== "object") {
            item.best_reason = {
              en: "Selected for a better balance of lower sodium, sugar, and saturated fat.",
              ms: "Dipilih kerana keseimbangan natrium, gula, dan lemak tepu yang lebih rendah.",
              zh: "因其钠、糖和饱和脂肪含量较低而被选为最佳选择。",
            };
          }
        } else {
          delete item.best_reason;
        }
      });

      // ── ALTERNATIVE SUGGESTION NORMALIZATION ─────────────────────────────────
      // The LLM may return tip/reason as plain strings (older prompt versions)
      // or numeric fields as strings (e.g. "3" instead of 3).
      // This block coerces everything to the expected types so the frontend
      // never has to defensive-check field types.
      // If the LLM omitted alternative_suggestion entirely, FALLBACK_ALTERNATIVES
      // provides safe hardcoded options for each category.
      // Normalize alternative_suggestion tip/reason to trilingual objects if present
      // Also normalize numeric nutrition fields (sugar, salt, fat) and risk
      let alternativeSuggestion = alternativeSuggestionFromLLM;
      if (alternativeSuggestion && typeof alternativeSuggestion === "object") {
        if (typeof alternativeSuggestion.tip === "string") {
          alternativeSuggestion = { ...alternativeSuggestion, tip: { en: alternativeSuggestion.tip, ms: alternativeSuggestion.tip, zh: alternativeSuggestion.tip } };
        }
        if (typeof alternativeSuggestion.reason === "string") {
          alternativeSuggestion = { ...alternativeSuggestion, reason: { en: alternativeSuggestion.reason, ms: alternativeSuggestion.reason, zh: alternativeSuggestion.reason } };
        }
        // Normalize numeric fields
        if (alternativeSuggestion.sugar !== undefined) alternativeSuggestion = { ...alternativeSuggestion, sugar: Number(alternativeSuggestion.sugar) || 0 };
        if (alternativeSuggestion.salt !== undefined) alternativeSuggestion = { ...alternativeSuggestion, salt: Number(alternativeSuggestion.salt) || 0 };
        if (alternativeSuggestion.fat !== undefined) alternativeSuggestion = { ...alternativeSuggestion, fat: Number(alternativeSuggestion.fat) || 0 };
        if (typeof alternativeSuggestion.risk === "string") {
          const r = alternativeSuggestion.risk.trim();
          alternativeSuggestion = { ...alternativeSuggestion, risk: r.charAt(0).toUpperCase() + r.slice(1).toLowerCase() };
        }
      }

      // If the LLM didn't return an alternative_suggestion, use the built-in fallback
      console.log(`[predict] 🔍 alt suggestion for "${cat}":`, JSON.stringify(alternativeSuggestion));
      if (!alternativeSuggestion) {
        alternativeSuggestion = FALLBACK_ALTERNATIVES[cat] ?? null;
      }

      finalResults[cat] = {
        ranking: allSorted,
        all_high_risk: allHighRisk,
        // Always include alternative_suggestion so the frontend can use it
        // when it independently detects all items are high risk.
        alternative_suggestion: alternativeSuggestion ?? null,
      };
    }

    const uniqueFoodCount =
      typeof rawData.uniqueFoodCount === "number"
        ? rawData.uniqueFoodCount
        : Object.values(rawData).filter(Array.isArray).flat().length;

    // ── FINAL RESPONSE SUMMARY LOG ────────────────────────────────────────────
    console.log(`[predict] ✅ Final response summary:`);
    for (const cat of ["Appetizer", "Main Dish", "Dessert", "Drinks"]) {
      const count = (finalResults[cat]?.ranking as unknown[])?.length ?? 0;
      console.log(`[predict]   "${cat}": ${count} item(s) in response`);
    }
    const totalFinal = Object.values(finalResults).reduce((sum, cat) => sum + ((cat.ranking as unknown[])?.length ?? 0), 0);
    console.log(`[predict]   Total items in response: ${totalFinal}`);
    console.log(`[predict]   uniqueFoodCount in response: ${uniqueFoodCount}`);
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({ ...finalResults, uniqueFoodCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}