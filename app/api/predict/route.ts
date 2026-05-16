// app/api/predict/route.ts
// Backend API endpoint for food analysis and recommendation system
// Uses Groq AI models: Llama-4-Scout for OCR and Llama-3.3-70B / GPT-OSS-120B for nutritional analysis
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

  const primaryKey = process.env.GOOGLE_API_KEY;
  const backupKey = process.env.GOOGLE_API_KEY_2;
  const groqKey = process.env.GROQ_API_KEY;

  if (!primaryKey && !backupKey && !groqKey) return [];

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
  if (primaryKey) {
    try {
      const result = await tryWithGoogleKey(primaryKey);
      console.log("[predict] ✅ OCR succeeded (Google primary key, Gemma 4 31B)");
      return result;
    } catch (err) {
      console.warn("[predict] ⚠️ OCR primary Google key failed:", (err as any)?.message ?? err);
    }
  }

  // 2. Try Google backup key (Gemma 4 31B)
  if (backupKey) {
    try {
      const result = await tryWithGoogleKey(backupKey);
      console.log("[predict] ✅ OCR succeeded (Google backup key, Gemma 4 31B)");
      return result;
    } catch (err) {
      console.warn("[predict] ⚠️ OCR backup Google key failed:", (err as any)?.message ?? err);
    }
  }

  // 3. Last resort: Llama-4-Scout via Groq
  try {
    const result = await tryWithLlama4Scout();
    console.log("[predict] ✅ OCR succeeded (Groq backup, Llama-4-Scout 17B)");
    return result;
  } catch (err) {
    console.error("[predict] ❌ All OCR attempts failed:", (err as any)?.message ?? err);
    return [];
  }
}

// ─── MODEL SELECTION ────────────────────────────────────────────────────────────────

/**
 * Returns the best Groq model for the given language.
 * Chinese (zh) uses gpt-oss-120b for better multilingual output quality.
 */
function getModelForLanguage(language: string): string {
  if (language === "zh") return "openai/gpt-oss-120b";
  return "llama-3.3-70b-versatile";
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
 * English/Malay are handled by llama-3.3-70b-versatile (good multilingual).
 * Chinese is routed to gpt-oss-120b via buildChineseTrilingualPrompt().
 */
function buildAnalysisPrompt(combinedOcr: string, userText: string): string {
  return `
CONTEXT:
Menu OCR (ALL items extracted from images): ${combinedOcr}
USER MANUAL INPUT: ${userText}

LANGUAGE REQUIREMENT:
- Return tip and best_reason as a JSON object with THREE language keys: "en" (English), "ms" (Bahasa Malaysia), "zh" (Simplified Chinese 简体中文).
- Food item names (field "f") must stay in their original language.
- All explanations inside the language objects must be in the correct language.

CRITICAL RULE:
- ONLY include food items that are EXPLICITLY named in the Menu OCR or USER MANUAL INPUT above. Do NOT invent or hallucinate any food item.

FOOD NAME NORMALIZATION RULES (apply before categorizing):
1. SPELLING CORRECTION: If any food name is a spelling variant of "Char Kway Teow" (e.g. "Char Kuey Teow", "Char Kwey Teow", "Char Koay Teow", "Cha Kway Teow", etc.), use the correct spelling: "Char Kway Teow".
2. SPECIAL CASE: Only if the exact phrase "Hainanese Chicken Rice" (or its direct translation) appears, record it as "Chicken Rice" (for database matching). Do NOT rename other nasi or chicken rice dishes.

TASK:
1. Process EVERY SINGLE item from BOTH Menu OCR AND USER MANUAL INPUT.
2. Categorize each item into exactly one of: 'Appetizer', 'Main Dish', 'Dessert', 'Drinks'.
   CATEGORIZATION RULES (follow strictly):
   - 'Drinks': water, plain water, air putih, mineral water, tea, coffee, kopi, teh, juice, cham, barley, cincau, soy bean, milo, coke, 100 plus, limau, lemon tea, any hot or cold beverage you drink through a cup or glass.
   - 'Dessert': sweet cold or iced items served as dessert — ice kacang, ais kacang, ABC, cendol, pudding, kuih, cake, sweet soups, any iced sweet food. IMPORTANT: ice kacang and cendol are DESSERT not Drinks.
   - 'Main Dish': rice dishes, noodles, chicken dishes, fish dishes, meat, hor fun, mee, any substantial meal item.
   - 'Appetizer': small starters and sides — satay, popiah, spring roll, bean sprout, lettuce, tofu side dishes, gizzard, liver, small soups served as starters.
3. Estimate for each item: Sugar(g), Salt/Sodium(mg), Saturated Fat(g), and Risk (Low/Medium/High).
   RISK DETERMINATION RULES (The "Three Highs"):
   - SUGAR: Low (≤5g), Medium (6-15g), High (>15g)
   - SALT (Sodium): Low (≤200mg), Medium (201-600mg), High (>600mg)
   - FAT (Saturated): Low (≤5g), Medium (6-15g), High (>15g)
   - ASSIGN FINAL RISK:
     - If ANY indicator is High -> Final Risk = "High"
     - Else if ANY indicator is Medium -> Final Risk = "Medium"
     - If ALL indicators are Low -> Final Risk = "Low"
4. Write a short practical health tip for EVERY item (one sentence) in all three languages:
   - NORMAL CASE: Focus on reducing salt, sugar, or fat for that specific item.
5. For EVERY item, include a "best_reason" object in all three languages explaining WHY this item is the best choice in its category.
6. ALTERNATIVE SUGGESTION RULE: For EVERY category that has at least one item, ALWAYS provide an "alternative_suggestion" object. The alternative MUST be a specific, contextually relevant healthier food that is NOT from the scanned/inputted items. Choose the alternative based on what is scanned — for example, if the scanned items are Malaysian hawker foods, suggest a lighter Malaysian alternative, not a generic western salad. The alternative must include: "f" (food name), "tip" (trilingual health tip), "reason" (trilingual explanation of why it's a healthier alternative), "sugar" (estimated sugar in grams, number), "salt" (estimated sodium in mg, number), "fat" (estimated fat in grams, number), "risk" ("Low", "Medium", or "High" based on the nutrition values). Also set "all_high_risk": true if ALL items in that category are "High" risk (even if only 1 or 2 items exist). Keep the top 3 scanned/inputted items as the main "ranking" — the alternative is displayed separately ABOVE the ranking only when all items are high risk.

RANKING LOGIC (apply per category):
1. Highest Priority: Risk (Low first, then Medium, then High)
2. Tie Breaker (same risk level): Salt (lower mg first), then Sugar (lower g first), then Saturated Fat (lower g first)

IMPORTANT OUTPUT RULES:
- Output ONLY the top 3 best items per category (already ranked). If fewer than 3, output all. If 0, output empty array.
- Output ONLY valid JSON. No markdown, no code fences, no extra text.
- Include "uniqueFoodCount" at root level: total unique real food items identified before filtering to top 3.
- Every category object must follow this shape:
  {"ranking":[...items...],"all_high_risk":boolean,"alternative_suggestion":{"f":"<specific food name>","sugar":number,"salt":number,"fat":number,"risk":"Low"|"Medium"|"High","tip":{"en":"...","ms":"...","zh":"..."},"reason":{"en":"...","ms":"...","zh":"..."}}}
- CRITICAL: "alternative_suggestion" must ALWAYS be a real object with "f", "sugar", "salt", "fat", "risk", "tip", and "reason" — NEVER null, NEVER omitted. Every category that has any items must have a specific alternative food suggestion.
- Every item must follow this shape:
  {"f":"name","sugar":number,"salt":number,"fat":number,"risk":"Low"|"Medium"|"High","tip":{"en":"...","ms":"...","zh":"..."},"best_reason":{"en":"...","ms":"...","zh":"..."}}
`;
}

/**
 * Builds the trilingual Chinese prompt for gpt-oss-120b.
 * Same trilingual structure but with Chinese reinforcement instructions.
 */
function buildChineseTrilingualPrompt(combinedOcr: string, userText: string): string {
  return `你是一个专业的营养分析API。你的输出必须仅包含一个有效的JSON对象，严禁包含任何Markdown格式（如 \`\`\`json）、解释性文字或开场白。

输入数据:
- 菜单OCR: ${combinedOcr}
- 用户手动输入: ${userText}

重要要求:
1. tip 和 best_reason 必须是包含三个语言键的对象: "en"(英文), "ms"(马来文), "zh"(简体中文)。食物原名(字段"f")保持不变。
2. 严禁虚构食物，仅分析提供的OCR或输入内容。
3. 如果项目过多，请优先处理前20个以确保响应不被截断。

食物名称规范化规则:
1. 拼写更正: 若食物名称是"Char Kway Teow"的拼写变体（如"Char Kuey Teow"、"Char Kwey Teow"、"Char Koay Teow"等），统一使用正确拼写: "Char Kway Teow"。
2. 特殊情况: 仅当出现确切短语"Hainanese Chicken Rice"（海南鸡饭）时，才记录为"Chicken Rice"（用于数据库匹配）。不得重命名其他鸡饭或米饭类菜肴。

任务:
1. 分类: 将项目归入 'Appetizer', 'Main Dish', 'Dessert', 'Drinks'。
2. 评估逻辑:
   - 糖(g): 低(≤5), 中(6-15), 高(>15)
   - 盐/钠(mg): 低(≤200), 中(201-600), 高(>600)
   - 脂肪(g): 低(≤5), 中(6-15), 高(>15)
   - 风险等级(risk): 任一指标高=High; 无高且有中=Medium; 全低=Low。
3. 字段说明:
   - 'tip': 针对减少盐、糖、脂的建议，三语对象。
   - 'best_reason': 基于营养优势的理由，三语对象。
4. 替代食物规则: 对于每个至少有一个食物项目的类别，无论风险高低，都必须提供"alternative_suggestion"对象。替代食物必须是具体的、与扫描内容相关的更健康食物，且不在扫描/输入内容中。根据扫描的食物选择替代品——例如，若扫描的是马来西亚小贩食物，建议更清淡的马来西亚替代品（如"Yong Tau Foo"、"清蒸鱼配蔬菜"、"Teh O Ais"等），而非泛泛的西式沙拉。包含: "f"(替代食物名称)、"sugar"(估计糖分克数，数字)、"salt"(估计钠毫克数，数字)、"fat"(估计脂肪克数，数字)、"risk"("Low"、"Medium"或"High"，根据营养值)、"tip"(三语健康提示)、"reason"(三语说明为何更健康)。如果该类别所有食物均为"High"风险，则设置"all_high_risk": true。
5. 排序: 风险等级(Low > Medium > High)，其次按盐 > 糖 > 脂肪从小到大排序。

输出格式要求:
- 每个类别只输出前3个最佳项目。
- 包含 "uniqueFoodCount" 字段。
- 必须严格遵守以下JSON结构，且确保括号完全闭合:

{
  "Appetizer": {"ranking": [{"f":"食物名称","sugar":数字,"salt":数字,"fat":数字,"risk":"Low"|"Medium"|"High","tip":{"en":"...","ms":"...","zh":"..."},"best_reason":{"en":"...","ms":"...","zh":"..."}}], "all_high_risk": false, "alternative_suggestion": {"f":"具体替代食物名称","sugar":数字,"salt":数字,"fat":数字,"risk":"Low"|"Medium"|"High","tip":{"en":"...","ms":"...","zh":"..."},"reason":{"en":"...","ms":"...","zh":"..."}}},
  "Main Dish": {"ranking": [], "all_high_risk": false, "alternative_suggestion": {"f":"具体替代食物名称","sugar":数字,"salt":数字,"fat":数字,"risk":"Low"|"Medium"|"High","tip":{"en":"...","ms":"...","zh":"..."},"reason":{"en":"...","ms":"...","zh":"..."}}},
  "Dessert": {"ranking": [], "all_high_risk": false, "alternative_suggestion": {"f":"具体替代食物名称","sugar":数字,"salt":数字,"fat":数字,"risk":"Low"|"Medium"|"High","tip":{"en":"...","ms":"...","zh":"..."},"reason":{"en":"...","ms":"...","zh":"..."}}},
  "Drinks": {"ranking": [], "all_high_risk": false, "alternative_suggestion": {"f":"具体替代食物名称","sugar":数字,"salt":数字,"fat":数字,"risk":"Low"|"Medium"|"High","tip":{"en":"...","ms":"...","zh":"..."},"reason":{"en":"...","ms":"...","zh":"..."}}},
  "uniqueFoodCount": 数字
}
注意: "alternative_suggestion" 绝对不能为 null，必须始终是包含具体食物名称的真实对象。`;
}

// ─── NUTRITIONAL ANALYSIS WITH GROQ ────────────────────────────────────────────────

async function analyzeWithGroq(
  combinedOcr: string,
  userText: string,
  apiKey: string | undefined,
): Promise<string> {
  if (!apiKey) throw new Error("API Key missing");

  // We always request trilingual output. Use the Chinese-capable model (gpt-oss-120b)
  // since it needs to produce zh text as well. For the English/Malay model we use
  // llama-3.3-70b-versatile, which also handles zh well enough inside a structured JSON.
  // Route: if primary fails, fallback uses same prompt — caller handles key rotation.
  const prompt = buildAnalysisPrompt(combinedOcr, userText);
  const model = "llama-3.3-70b-versatile"; // handles trilingual JSON reliably

  console.log(`[predict] Using model: ${model} (trilingual)`);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a health assistant. Always output valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Analysis error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "{}";
}

/**
 * Fallback: if llama fails for Chinese quality, retry with gpt-oss-120b.
 * This is the secondary fallback specifically for zh output quality.
 */
async function analyzeWithChineseModel(
  combinedOcr: string,
  userText: string,
  apiKey: string | undefined,
): Promise<string> {
  if (!apiKey) throw new Error("API Key missing");
  const prompt = buildChineseTrilingualPrompt(combinedOcr, userText);
  const model = "openai/gpt-oss-120b";

  console.log(`[predict] Using model: ${model} (trilingual Chinese-capable)`);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "请始终输出有效的JSON格式。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      // gpt-oss-120b has stricter JSON validation; omit response_format
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GPT-OSS Analysis error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "{}";
}

async function analyzeWithFallback(
  combinedOcr: string,
  userText: string,
): Promise<string> {
  try {
    const result = await analyzeWithGroq(combinedOcr, userText, process.env.GROQ_API_KEY);
    console.log("[predict] ✅ Analysis succeeded (Key 1, llama-3.3-70b)");
    return result;
  } catch (err) {
    console.warn(`[predict] ⚠️ Key 1 failed — trying Key 2. Error: ${err}`);
    try {
      const result = await analyzeWithGroq(combinedOcr, userText, process.env.GROQ_API_KEY_2);
      console.log("[predict] ✅ Analysis succeeded (Key 2, llama-3.3-70b)");
      return result;
    } catch (err2) {
      console.warn(`[predict] ⚠️ Key 2 also failed — retrying with gpt-oss-120b. Error: ${err2}`);
      // Last resort: Chinese-capable model for better trilingual output
      const result = await analyzeWithChineseModel(combinedOcr, userText, process.env.GROQ_API_KEY);
      console.log("[predict] ✅ Analysis succeeded (gpt-oss-120b fallback)");
      return result;
    }
  }
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
 *   3. LLM analysis — llama-3.3-70b-versatile (Groq) classifies each item into
 *             Appetizer / Main Dish / Dessert / Drinks, estimates Sugar/Sodium/Fat,
 *             assigns risk, and writes trilingual tips in a single JSON response.
 *   4. DB merge — matched items get verified nutrition values from the SIHAT DB.
 *   5. Ranking — items sorted Low→High risk, then Salt→Sugar→Fat ascending.
 *   6. Response — top 3 per category + alternative_suggestion + all_high_risk flag.
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

    // Normalize user text items (spelling + special cases)
    const normalizedUserText = userText
      .split(",")
      .map((s) => normalizeFoodItemName(s.trim()))
      .filter(Boolean)
      .join(", ");

    // Perform trilingual nutritional analysis
    const rawJson = await analyzeWithFallback(combinedOcr, normalizedUserText);

    let rawData: Record<string, unknown[]>;
    try {
      rawData = safeParseJson(rawJson);
    } catch {
      rawData = JSON.parse(rawJson);
    }

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
      const items = (Array.isArray(catData) ? catData : (catData as any)?.ranking ?? []) as Record<string, any>[];
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

        // ── RANKING BUG FIX: normalise risk before mapping ──────────────
        const normalisedRisk = normaliseRisk(item.risk);
        item.risk = normalisedRisk; // write back the clean value
        item.risk_score = riskMap[normalisedRisk] ?? 2;
        // ─────────────────────────────────────────────────────────────────
      }

      // ── RANKING ──────────────────────────────────────────────────────────────
      // Primary sort: risk score (Low=1, Medium=2, High=3) — healthiest first.
      // Tie-breakers within the same risk band: Salt → Sugar → Fat (lower = better).
      // This ranking logic matches the UI disclaimer shown to users.
      // Sort: risk ascending (Low=1 first), then salt, sugar, fat
      const sorted = [...items].sort((a, b) => {
        if (a.risk_score !== b.risk_score) return a.risk_score - b.risk_score;
        if (a.salt !== b.salt) return a.salt - b.salt;
        if (a.sugar !== b.sugar) return a.sugar - b.sugar;
        return a.fat - b.fat;
      });

      const top3 = sorted.slice(0, 3);

      // Determine if all items in this category are high risk
      const allHighRisk = allHighRiskFromLLM || (top3.length > 0 && top3.every((item) => normaliseRisk(item.risk) === "High"));

      top3.forEach((item: any, idx: number) => {
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
          // Ensure best_reason is always a trilingual object
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
      if (!alternativeSuggestion) {
        alternativeSuggestion = FALLBACK_ALTERNATIVES[cat] ?? null;
      }

      finalResults[cat] = {
        ranking: top3,
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

    return NextResponse.json({ ...finalResults, uniqueFoodCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}