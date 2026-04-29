// app/api/predict/route.ts
// Backend API endpoint for food analysis and recommendation system
// Uses Groq AI models: Llama-4-Scout for OCR and Llama-3.3-70B for nutritional analysis
// Implements API key fallback strategy for reliability
// Supports multi-language analysis based on user preference
 
import { NextRequest, NextResponse } from "next/server";
 
export const maxDuration = 60; // Maximum execution time for the API route (60 seconds)
 
// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────────────
 
/**
 * Converts various input types to numbers for nutritional data processing
 * Handles string parsing, removes non-numeric characters, and provides fallback to 0
 * @param value - Input value that could be number, string, or other types
 * @returns Cleaned numeric value or 0 if conversion fails
 */
function cleanToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const n = cleaned.includes(".") ? parseFloat(cleaned) : parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}
 
/**
 * Safely parses JSON responses from AI models that might include markdown formatting
 * Handles nested JSON objects by tracking brace depth and string literals
 * @param raw - Raw string response from AI model
 * @returns Parsed JSON object
 * @throws Error if no valid JSON object found
 */
function safeParseJson(raw: string): Record<string, unknown[]> {
  const stripped = raw.replace(/```json\s*|```/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");
 
  let depth = 0;
  let inString = false;
  let escape = false;
 
  // Parse character by character to handle nested structures properly
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
 * Handles JSON parsing, string trimming, and item filtering
 * @param rawContent - Raw OCR content from Groq API
 * @returns Array of extracted food and drink items
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
 * Uses a Map to track unique items and returns the resulting array
 * @param items - Array of items to deduplicate
 * @returns Array of unique items
 */
function deduplicateItems(items: string[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = item.toLowerCase().trim().replace(/\s+/g, " ");
    if (!seen.has(key)) seen.set(key, item.trim());
  }
  return Array.from(seen.values());
}
 
// ─── OCR PROCESSING WITH GROQ (Llama-4-Scout) ───────────────────────────
 
/**
 * Executes OCR request to Groq API using Llama-4-Scout model
 * Sends base64 encoded image with detailed menu analysis instructions
 * @param apiKey - Groq API authentication key
 * @param base64 - Base64 encoded image data
 * @param mimeType - Image MIME type (e.g., 'image/jpeg')
 * @returns Promise resolving to Groq API response
 * @throws Error if API request fails
 */
async function executeGroqOcrRequest(apiKey: string, base64: string, mimeType: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              // Comprehensive OCR prompt with adaptive detection strategies
              text: `You are a menu analysis engine. Extract every unique food and drink item.

DETECTION STRATEGY (Adaptive):
1. IF PRICES EXIST: Use prices or codes (A1, RM10) as anchors to identify valid items.
2. IF NO PRICES EXIST: Identify items based on list structure. Look for:
   - Items aligned in a vertical column.
   - Text preceded by bullet points, icons, or checkboxes.
   - Text positioned directly below or next to a food photo.
3. HIERARCHY RULE: Identify and IGNORE large category headers (e.g., "NASI GORENG", "DRINKS"). Only extract the specific sub-items listed under them.
4. DECORATION RULE: Ignore generic background illustrations that are not part of the structured list.

Formatting:
- Return ONLY valid JSON: {"items": ["Item 1", "Item 2"]}`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      response_format: { type: "json_object" }, // Enforce JSON response
      temperature: 0.1, // Low temperature for consistent results
    }),
  });
 
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error((errorData as any)?.error?.message || `Groq OCR error ${res.status}`);
  }
  return await res.json();
}
 
/**
 * Processes a single image using OCR and extracts food and drink items
 * Handles API key fallback and error handling
 * @param arrayBuffer - Image data as an array buffer
 * @param mimeType - Image MIME type (e.g., 'image/jpeg')
 * @returns Promise resolving to an array of extracted items
 */
async function processSingleImage(arrayBuffer: ArrayBuffer, mimeType: string): Promise<string[]> {
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const primaryKey = process.env.GROQ_API_KEY;
  const backupKey = process.env.GROQ_API_KEY_2;

  if (!primaryKey && !backupKey) return [];

  const tryWithKey = async (apiKey: string) => {
    const ocrResult = await executeGroqOcrRequest(apiKey, base64, mimeType);
    const rawContent = ocrResult?.choices?.[0]?.message?.content ?? "";
    const parsed = parseItemsFromOcrContent(rawContent);
    return deduplicateItems(parsed);
  };

  try {
    if (!primaryKey) throw new Error("Primary OCR key missing");
    return await tryWithKey(primaryKey);
  } catch (err) {
    console.warn("[predict] ⚠️ OCR primary key failed, trying backup...", err);
    try {
      if (!backupKey) return [];
      return await tryWithKey(backupKey);
    } catch {
      return [];
    }
  }
}

// ─── MODEL SELECTION ────────────────────────────────────────────────────────────────

/**
 * Returns the best Groq model for the given language.
 *
 * WHY: llama-3.3-70b-versatile has poor Simplified Chinese output — it tends to
 * hallucinate nonsense characters, mix scripts, or repeat garbled phrases.
 * mixtral-8x7b-32768 has significantly better multilingual (especially Chinese)
 * text generation quality on Groq, so we route zh requests to it instead.
 *
 * @param language - BCP-47 language code (e.g. 'en', 'ms', 'zh')
 * @returns Groq model identifier string
 */
function getModelForLanguage(language: string): string {
  if (language === "zh") return "openai/gpt-oss-120b";
  return "llama-3.3-70b-versatile";
}

// ─── Shared prompt builder ─────────────────────────────────────────────────────

/**
 * Builds comprehensive analysis prompt for AI model.
 * Includes language requirements, categorization rules, and nutritional analysis guidelines.
 *
 * Language handling notes:
 * - Each language entry has a human-readable label AND a native-language reinforcement
 *   instruction. Writing the reinforcement in the target language itself dramatically
 *   improves model compliance (LLMs respond better to native-script instructions).
 * - "zh" explicitly specifies "Simplified Chinese (简体中文)" — just saying "Chinese"
 *   is ambiguous and causes models to output Traditional Chinese, pinyin, or mixed scripts.
 *
 * @param combinedOcr - OCR results from all images
 * @param userText - Manual input from user
 * @param language - BCP-47 language code (defaults to 'en')
 * @returns Complete prompt string for AI analysis
 */
function buildAnalysisPrompt(combinedOcr: string, userText: string, language: string = "en"): string {
  if (language === "zh") {
    return buildChinesePrompt(combinedOcr, userText);
  }
  
  const languageMap: Record<string, { label: string; reinforcement: string }> = {
    "en": {
      label: "English",
      reinforcement: "All explanations must be written in clear English.",
    },
    "ms": {
      label: "Bahasa Malaysia",
      reinforcement: "Semua penjelasan mesti ditulis dalam Bahasa Malaysia yang jelas dan betul.",
    },
  };

  const { label: targetLanguage, reinforcement } = languageMap[language] ?? languageMap["en"];
  
  return `
CONTEXT:
Menu OCR (ALL items extracted from images): ${combinedOcr}
USER MANUAL INPUT: ${userText}
LANGUAGE: ${targetLanguage} (${language})
 
CRITICAL LANGUAGE REQUIREMENT:
- You must provide ALL analysis, tips, recommendations, and best_reason fields entirely in ${targetLanguage}.
- ${reinforcement}
- If language is unsupported, default to English.
- All food item names should remain in their original language, but all explanations must be in ${targetLanguage}.
 
CRITICAL RULE:
- ONLY include food items that are EXPLICITLY named in the Menu OCR or USER MANUAL INPUT above. Do NOT invent or hallucinate any food item.
 
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
   - For each indicator, determine the level:
     - SUGAR: Low (≤5g), Medium (6-15g), High (≥16g)
     - SALT (Sodium): Low (≤200mg), Medium (201-600mg), High (>600mg)
     - FAT (Saturated): Low (≤3g), Medium (3.1-7g), High (>7g)
   - ASSIGN FINAL RISK:
     - If ANY indicator is High -> Final Risk = "High"
     - Else if ANY indicator is Medium -> Final Risk = "Medium"
     - If ALL indicators are Low -> Final Risk = "Low"
4. Write a short practical health tip for EVERY item (one sentence):
   - NORMAL CASE: Focus on reducing salt, sugar, or fat for that specific item (e.g., "Ask for less sauce", "Skip the sweet syrup", "Choose grilled instead of fried")
   - ALL HIGH RISK CASE: If all top 3 items in a category are High risk, change the tip to recommend a similar healthier food alternative outside the scanned items (e.g., "Try plain water instead of sweet drinks", "Choose fresh fruit instead of sweet desserts", "Opt for clear soup instead of creamy dishes")
5. For EVERY item, include a "best_reason" field explaining WHY this specific item is the best choice compared to others in its category:
   - Focus on the nutritional advantages (e.g., "Chinese tea is the best drink choice because it contains the least amount of sugar, salt, and fat among all drinks")
   - Compare it to other items in the same category
   - Explain the specific health benefits based on the Three Highs
   - Make it different from the tip - tip is actionable advice, best_reason is the rationale

RANKING LOGIC (apply per category):
1. Highest Priority: Risk (Low first, then Medium, then High)
2. Tie Breaker (tie-breaker if there are multiple items with the same risk[3 top items all have low risks for example] then rank those 3 items based on in order Salt, Sugar, then Saturated Fat):
  -Salt (lower mg first)
  -Sugar (lower g first)
  -Saturated Fat (lower g first)
 
IMPORTANT OUTPUT RULES:
- Output ONLY the top 3 best items per category (already ranked). If a category has fewer than 3 items, output all of them. If a category has 0 items, output an empty array.
- Output ONLY valid JSON. No markdown, no code fences, no extra text, nothing after the closing brace.
- Also include a "uniqueFoodCount" field at the root level: the total number of unique, real food items you identified and processed from BOTH Menu OCR and USER MANUAL INPUT (before filtering to top 3). This count should exclude duplicates and non-food text like headings, prices, or menu section names.
- Use this exact structure:
{"Appetizer":[],"Main Dish":[],"Dessert":[],"Drinks":[],"uniqueFoodCount":number}
- Every item must follow this shape: {"f":"name","sugar":number,"salt":number,"fat":number,"risk":"Low"|"Medium"|"High","tip":"string","best_reason":"string"}
`;
}

/**
 * Builds simplified Chinese prompt for GPT-OSS model with stricter JSON formatting.
 * Uses explicit JSON structure and removes response_format constraint to avoid validation errors.
 *
 * @param combinedOcr - OCR results from all images
 * @param userText - Manual input from user
 * @returns Simplified Chinese prompt with explicit JSON structure
 */

function buildChinesePrompt(combinedOcr: string, userText: string): string {
  return `你是一个专业的营养分析API。你的输出必须仅包含一个有效的JSON对象，严禁包含任何Markdown格式（如 \`\`\`json）、解释性文字或开场白。

输入数据:
- 菜单OCR: ${combinedOcr}
- 用户手动输入: ${userText}

重要要求:
1. 所有分析、提示和建议必须使用简体中文。食物原名保持不变。
2. 严禁虚构食物，仅分析提供的OCR或输入内容。
3. 如果项目过多，请优先处理前20个以确保响应不被截断。

任务:
1. 分类: 将项目归入 'Appetizer', 'Main Dish', 'Dessert', 'Drinks'。
2. 评估逻辑:
   - 糖(g): 低(≤5), 中(6-15), 高(>15)
   - 盐/钠(mg): 低(≤200), 中(201-600), 高(>600)
   - 脂肪(g): 低(≤3), 中(3.1-7), 高(>7)
   - 风险等级(risk): 任一指标高=High; 无高且有中=Medium; 全低=Low。
3. 字段说明:
   - 'tip': 针对减少盐、糖、脂的建议。
   - 'best_reason': 基于"三高"（高血压、高血糖、高血脂）人群的健康获益解释。
4. 排序: 风险等级(Low > Medium > High)，其次按盐 > 糖 > 脂肪从小到大排序。

输出格式要求:
- 每个类别只输出前3个最佳项目。
- 包含 "uniqueFoodCount" 字段。
- 必须严格遵守以下JSON结构，且确保括号完全闭合:

{
  "Appetizer": [{"f":"食物名称","sugar":数字,"salt":数字,"fat":数字,"risk":"Low"|"Medium"|"High","tip":"简短建议","best_reason":"理由"}],
  "Main Dish": [],
  "Dessert": [],
  "Drinks": [],
  "uniqueFoodCount": 数字
}`;
}

// ─── NUTRITIONAL ANALYSIS WITH GROQ ────────────────────────────────────────────────
 
/**
 * Executes nutritional analysis request to Groq API.
 * Automatically selects the best model for the given language — notably,
 * Chinese (zh) uses mixtral-8x7b-32768 instead of llama-3.3-70b-versatile
 * because the latter produces garbled/hallucinated Chinese text.
 *
 * @param combinedOcr - Combined OCR results from all images
 * @param userText - Manual user input of food items
 * @param apiKey - Groq API authentication key
 * @param language - BCP-47 language code (defaults to 'en')
 * @returns Promise resolving to AI analysis response as JSON string
 * @throws Error if API key missing or request fails
 */
async function analyzeWithGroq(
  combinedOcr: string,
  userText: string,
  apiKey: string | undefined,
  language: string = "en"
): Promise<string> {
  if (!apiKey) throw new Error("API Key missing");
  const prompt = buildAnalysisPrompt(combinedOcr, userText, language);
  const model = getModelForLanguage(language);

  console.log(`[predict] Using model: ${model} for language: ${language}`);

  // Build request body differently for Chinese vs other languages
  const requestBody: any = {
    model,
    messages: [
      { role: "system", content: language === "zh" ? "请始终输出有效的JSON格式。" : "You are a health assistant. Always output valid JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0.1,
  };

  // Only add response_format for non-Chinese models (GPT-OSS has stricter JSON validation)
  if (language !== "zh") {
    requestBody.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Analysis error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "{}";
}

// ─── ANALYSIS WITH API KEY FALLBACK ────────────────────────────────────────────────
 
/**
 * Executes nutritional analysis with API key fallback strategy
 * Tries primary key first, then falls back to backup key if primary fails
 * @param combinedOcr - Combined OCR results from all images
 * @param userText - Manual user input of food items
 * @param language - BCP-47 language code (defaults to 'en')
 * @returns Promise resolving to AI analysis response as JSON string
 */
async function analyzeWithFallback(
  combinedOcr: string,
  userText: string,
  language: string = "en"
): Promise<string> {
  try {
    // Primary: Key 1 (GROQ_API_KEY)
    const result = await analyzeWithGroq(combinedOcr, userText, process.env.GROQ_API_KEY, language);
    console.log("[predict] ✅ Analysis succeeded (Key 1)");
    return result;
  } catch (err) {
    console.warn(`[predict] ⚠️ Analysis Key 1 failed — trying Key 2. Error: ${err}`);
    // Secondary: Key 2 (GROQ_API_KEY_2)
    const result = await analyzeWithGroq(combinedOcr, userText, process.env.GROQ_API_KEY_2, language);
    console.log("[predict] ✅ Analysis succeeded (Key 2)");
    return result;
  }
}

// ─── MAIN API ROUTE HANDLER ────────────────────────────────────────────────────────────
 
/**
 * Main API endpoint handler for food analysis and recommendation system
 * Processes uploaded images and text input, performs OCR and nutritional analysis
 * @param req - Next.js API request object
 * @returns Promise resolving to JSON response with categorized food recommendations
 * @throws Error if processing fails
 */
export async function POST(req: NextRequest) {
  try {
    // Extract form data from request
    const formData = await req.formData();
    const userText = (formData.get("userText") as string) ?? "";
    const files = formData.getAll("file") as File[];
    const language = (formData.get("language") as string) ?? "en"; // Get language from frontend

    // Process all uploaded images with OCR (max 5 images)
    const ocrResults = await Promise.all(
      files.slice(0, 5).map(async (file) => {
        const buf = await file.arrayBuffer();
        return processSingleImage(buf, file.type || "image/jpeg");
      })
    );
    // Combine and deduplicate OCR results from all images
    const combinedOcr = deduplicateItems(ocrResults.flat()).join("\n");

    // Perform nutritional analysis with language support
    const rawJson = await analyzeWithFallback(combinedOcr, userText, language);

    // Parse AI response safely
    let rawData: Record<string, unknown[]>;
    try {
      rawData = safeParseJson(rawJson);
    } catch {
      rawData = JSON.parse(rawJson);
    }
 
    // Risk level mapping for sorting
    const riskMap: Record<string, number> = { 
      "Low": 1, "Low Risk": 1, 
      "Medium": 2, "Medium Risk": 2, 
      "High": 3, "High Risk": 3 
    };

    const finalResults: Record<string, { ranking: unknown[] }> = {};
 
    // Process each food category (Appetizer, Main Dish, Dessert, Drinks)
    for (const cat of ["Appetizer", "Main Dish", "Dessert", "Drinks"]) {
      const items = (rawData[cat] ?? []) as Record<string, any>[];

      // Clean and validate nutritional data for each item
      for (const item of items) {
        item.sugar = cleanToNumber(item.sugar ?? 0);
        item.salt = cleanToNumber(item.salt ?? 0);
        item.fat = cleanToNumber(item.fat ?? 0);
        item.risk_score = riskMap[String(item.risk).trim()] ?? 2;
      }

      // Sort items by risk level (primary) and nutritional values (secondary)
      const sorted = [...items].sort((a, b) => {
        if (a.risk_score !== b.risk_score) return a.risk_score - b.risk_score;
        if (a.salt !== b.salt) return a.salt - b.salt;
        if (a.sugar !== b.sugar) return a.sugar - b.sugar;
        return a.fat - b.fat;
      });

      // Keep only top 3 items per category
      const top3 = sorted.slice(0, 3);

      // Clean up data structure and add best reason for top item
      top3.forEach((item: any, idx: number) => {
        delete item.risk_score;
        if (idx === 0) {
          if (!item.best_reason || String(item.best_reason).trim() === "") {
            item.best_reason = "Selected for a better balance of lower sodium, sugar, and saturated fat.";
          }
        } else {
          delete item.best_reason;
        }
      });

      finalResults[cat] = { ranking: top3 };
    }
 
    // Calculate unique food count from AI response or fallback
    const uniqueFoodCount = typeof rawData.uniqueFoodCount === 'number' 
      ? rawData.uniqueFoodCount 
      : Object.values(rawData).filter(Array.isArray).flat().length;

    // Return final results with unique food count
    return NextResponse.json({ ...finalResults, uniqueFoodCount });

  } catch (err: unknown) {
    // Error handling with proper error message
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}