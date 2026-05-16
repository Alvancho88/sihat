// app/api/chat/route.ts
// Epic 9: AI Conversational Health Assistant
// Chat: Groq/Llama only (llama-3.3-70b-versatile). Gemma OCR stays in app/api/predict.
// Supports context-aware advice from food scan sessionStorage data
// Supports multi-language: English, Bahasa Malaysia, Simplified Chinese

import { NextRequest, NextResponse } from "next/server";
import { getAllFoodData, type FoodDataRow } from "@/lib/queries";
import { buildDailyIntakeSummary, type DailyIntakeSummary } from "@/lib/daily-intake-summary";
import { type FoodItem, getSugarLevel, getGILevel, getFatLevel, getSodiumLevel } from "@/lib/food-functions";
import { computeRiskFromIndicators, parseNutrientNumber as parseNutrientFromDisplayString } from "@/lib/food-recognition-risk";

export const maxDuration = 30;

type LangCode = "en" | "ms" | "zh";
type ScanCategory = "Main Dish" | "Appetizer" | "Dessert" | "Drinks";

type EstimatedFoodCategory = "Main Dish" | "Appetizer" | "Dessert" | "Drink";
interface EstimatedFoodCard {
  name: string;
  category: EstimatedFoodCategory | null;
  risk: "low" | "medium" | "high";
  tip: string;
  /** Estimated grams sugar per serving */
  sugar?: number;
  /** Estimated sodium mg per serving */
  sodium?: number;
  /** Estimated grams fat per serving (same field semantics as menu analysis) */
  fat?: number;
}

interface ChatResponse {
  reply: string;
  action?: {
    type: "add" | "remove" | "clear";
    food?: FoodItem;
  };
  suggestions?: FoodItem[];
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

interface ScanFoodItem {
  f: string;       // food name
  sugar: number;   // sugar in grams
  salt: number;    // sodium in mg
  fat: number;     // saturated fat in grams
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

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  language?: LangCode;
  scanContext?: {
    "Appetizer"?: { ranking: ScanFoodItem[] };
    "Main Dish"?: { ranking: ScanFoodItem[] };
    "Dessert"?: { ranking: ScanFoodItem[] };
    "Drinks"?: { ranking: ScanFoodItem[] };
    uniqueFoodCount?: number;
  } | null;
  cart?: FoodItem[];
  intakeSummary?: DailyIntakeSummary;
}

// ─── QUICK FOOD GUIDANCE BUILDERS ─────────────────────────────────────────────

function getLocalizedRiskLabel(risk: "low" | "medium" | "high", lang: LangCode): string {
  const labels = {
    en: { low: "low-risk", medium: "medium-risk", high: "high-risk" },
    ms: { low: "risiko rendah", medium: "risiko sederhana", high: "risiko tinggi" },
    zh: { low: "低风险", medium: "中等风险", high: "高风险" },
  };
  return labels[lang][risk];
}

function buildQuickFoodSummary(food: FoodItem, lang: LangCode): string {
  const labels = {
    en: {
      lowerSugar: "✅ Lower sugar than many sweet foods",
      highGi: "⚠️ May raise blood sugar quickly",
      highSodiumFat: "⚠️ Higher in fat and sodium",
      highSodium: "⚠️ Higher in sodium",
      highFat: "⚠️ Higher in fat",
      tip: "Health Tip",
      intro: (foodName: string, risk: string) => `${foodName} is a ${risk} food for the Three Highs.`,
    },
    ms: {
      lowerSugar: "✅ Gula lebih rendah berbanding banyak makanan manis",
      highGi: "⚠️ Boleh menaikkan gula darah dengan cepat",
      highSodiumFat: "⚠️ Lebih tinggi lemak dan natrium",
      highSodium: "⚠️ Lebih tinggi natrium",
      highFat: "⚠️ Lebih tinggi lemak",
      tip: "Tip Kesihatan",
      intro: (foodName: string, risk: string) => `${foodName} ialah makanan ${risk} untuk Tiga Tinggi.`,
    },
    zh: {
      lowerSugar: "✅ 糖分比许多甜食低",
      highGi: "⚠️ 可能较快升高血糖",
      highSodiumFat: "⚠️ 脂肪和钠较高",
      highSodium: "⚠️ 钠较高",
      highFat: "⚠️ 脂肪较高",
      tip: "健康提示",
      intro: (foodName: string, risk: string) => `${foodName} 是三高方面的${risk}食物。`,
    },
  }[lang];

  const foodName = food.name[lang] || food.name.en;
  const tip = food.tip[lang] || food.tip.en || "";
  const sugarLevel = getSugarLevel(food.sugar);
  const giLevel = getGILevel(food.gi);
  const fatLevel = getFatLevel(food.fat);
  const sodiumLevel = getSodiumLevel(food.sodium);
  const sugarN = parseNutrientFromDisplayString(food.sugar);
  const sodiumN = parseNutrientFromDisplayString(food.sodium);
  const fatN = parseNutrientFromDisplayString(food.fat);
  const risk = computeRiskFromIndicators(sugarN, sodiumN, fatN, food.risk);

  const notes: string[] = [];
  if (sugarLevel === "low") notes.push(labels.lowerSugar);
  if (giLevel === "high") notes.push(labels.highGi);
  if (sodiumLevel === "high" && fatLevel === "high") {
    notes.push(labels.highSodiumFat);
  } else {
    if (sodiumLevel === "high") notes.push(labels.highSodium);
    if (fatLevel === "high") notes.push(labels.highFat);
  }

  return compactBlankLines(`${labels.intro(foodName, getLocalizedRiskLabel(risk, lang))}

${notes.slice(0, 2).join("\n")}

${labels.tip}:
${tip}`);
}

/** Structured payload for a single database-matched food (frontend FoodSummaryCard + buttons). */
function buildStructuredDatabaseFoodResponse(
  food: FoodItem,
  lang: LangCode,
  openFullLabels: Record<LangCode, string>
): ChatResponse {
  return {
    reply: buildQuickFoodSummary(food, lang),
    suggestions: [food],
    actionButton: { label: openFullLabels[lang], href: "/recommendation" },
    isMultiFood: false,
  };
}

// ─── CART MANAGEMENT ──────────────────────────────────────────────────────────

type FoodMatchResult =
  | { status: "matched"; food: FoodItem }
  | { status: "ambiguous"; foods: FoodItem[] }
  | { status: "none" }

function messageContainsAsciiToken(message: string, token: string): boolean {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(message);
}

function messageContainsAnyMarker(message: string, markers: string[]): boolean {
  return markers.some((m) => (/[^\x00-\x7f]/.test(m) ? message.includes(m) : messageContainsAsciiToken(message, m)));
}

/** "加" alone is too broad (e.g. 增加); only treat as add when it reads like "…帮我加[食物]". */
function messageSuggestChineseAddJia(message: string): boolean {
  if (/(增加|增長|增长)/.test(message)) return false;
  return /(帮|幫|请|請|那|麻烦|麻煩).{0,12}加/u.test(message);
}

function parseCartCommand(message: string, foods: FoodItem[], lang: LangCode): { action: string; food?: FoodItem; suggestions?: FoodItem[]; query?: string } | null {
  const lowerMsg = message.toLowerCase();
  const labels = {
    en: { add: ["add", "put", "include", "insert"], remove: ["remove", "delete"], clear: ["clear", "empty"], view: ["what is in my food plan", "show my plan", "my food plan"] },
    ms: { add: ["tambah", "masukkan"], remove: ["buang", "padam"], clear: ["kosongkan", "clear"], view: ["apa dalam pelan makanan saya", "tunjuk pelan saya"] },
    zh: { add: ["添加", "加入", "放", "加"], remove: ["删除", "移除"], clear: ["清空"], view: ["我的食物计划有什么"] },
  };

  const l = labels[lang];
  const stripLang = detectUserMessageLanguage(message) ?? lang;

  const addMarkersAll = [...labels.en.add, ...labels.ms.add, "添加", "加入", "放"];
  const removeMarkersAll = [...labels.en.remove, ...labels.ms.remove, ...labels.zh.remove];

  // Check for clear
  if (l.clear.some((word) => lowerMsg.includes(word))) {
    return { action: "clear" };
  }

  // Check for view
  if (l.view.some((phrase) => lowerMsg.includes(phrase))) {
    return { action: "view" };
  }

  // Check for add/remove — markers from any language (user may type Chinese while UI is English).
  for (const action of ["remove", "add"] as const) {
    const markers = action === "add" ? addMarkersAll : removeMarkersAll;
    const addIntent =
      action === "add" &&
      (messageContainsAnyMarker(message, markers) || messageSuggestChineseAddJia(message));
    const removeIntent = action === "remove" && messageContainsAnyMarker(message, markers);
    if (!addIntent && !removeIntent) continue;
    const query = stripCartIntent(message, action, stripLang);
    const foodMatch = matchFoodQuery(query, foods);
    if (foodMatch.status === "matched") return { action, food: foodMatch.food, query };
    if (foodMatch.status === "ambiguous") return { action, suggestions: foodMatch.foods, query };
    return { action, query };
  }

  return null;
}

function updateCart(cart: FoodItem[], command: { action: string; food?: FoodItem; suggestions?: FoodItem[]; query?: string }, lang: LangCode): ChatResponse {
  const labels = {
    en: {
      added: "added to your daily plan.",
      removed: "removed from your plan.",
      cleared: "Your food plan has been cleared.",
      notFound: "Sorry, I could not find that food in our list.",
      unavailablePrefix: "Sorry,",
      unavailableSuffix: "is not available in the food list.",
      choose: "Here are some similar foods you can try:",
      canAdd: "You can add:",
      alreadyIn: "Already in your plan.",
      notIn: "Not in your plan.",
      thisFood: "That food",
    },
    ms: {
      added: "Ditambah ke pelan harian anda.",
      removed: "Dibuang dari pelan anda.",
      cleared: "Pelan makanan anda telah dikosongkan.",
      notFound: "Maaf, makanan itu tidak ada dalam senarai kami.",
      unavailablePrefix: "Maaf,",
      unavailableSuffix: "tidak ada dalam senarai makanan.",
      choose: "Cuba pilih daripada makanan yang serupa:",
      canAdd: "Anda boleh tambah:",
      alreadyIn: "Sudah ada dalam pelan anda.",
      notIn: "Tidak ada dalam pelan anda.",
      thisFood: "Makanan itu",
    },
    zh: {
      added: "已添加到您的每日计划。",
      removed: "已从您的计划中移除。",
      cleared: "您的食物计划已清空。",
      notFound: "抱歉，我们的食物列表中没有这个食物。",
      unavailablePrefix: "抱歉，",
      unavailableSuffix: "不在食物列表中。",
      choose: "以下是一些相似的食物，您可以试试：",
      canAdd: "您可以添加：",
      alreadyIn: "已经在您的计划中。",
      notIn: "不在您的计划中。",
      thisFood: "该食物",
    },
  };

  const l = labels[lang];

  if (command.action === "clear") {
    return { reply: l.cleared, action: { type: "clear" } };
  }

  if (command.action === "view") {
    if (cart.length === 0) {
      return { reply: "Your food plan is empty." };
    }
    const foodNames = cart.map(f => `• ${f.name[lang] || f.name.en}`).join('\n');
    const totalCalories = cart.reduce((sum, f) => sum + parseInt(f.calories.replace(/\D/g, ''), 10), 0);
    return { reply: `You currently have:\n${foodNames}\n\nTotal Calories: ${totalCalories}` };
  }

  if (command.suggestions?.length) {
    const unavailableFoodName = formatUnavailableFoodName(command.query, lang) || l.thisFood;
    return {
      reply: `${l.unavailablePrefix} ${unavailableFoodName} ${l.unavailableSuffix}\n\n${l.choose}`,
      suggestions: command.suggestions,
      unavailableFoodName,
    };
  }

  if (!command.food) {
    const unavailableFoodName = formatUnavailableFoodName(command.query, lang) || l.thisFood;
    return {
      reply: command.action === "add"
        ? `${l.unavailablePrefix} ${unavailableFoodName} ${l.unavailableSuffix}`
        : l.notFound,
      unavailableFoodName: command.action === "add" ? unavailableFoodName : undefined,
    };
  }

  if (command.action === "add") {
    const foodName = command.food.name[lang] || command.food.name.en;
    if (cart.some(f => f.name.en === command.food!.name.en)) {
      const alreadyInMessages = {
        en: `${foodName} is already in your daily plan.`,
        ms: `${foodName} sudah ada dalam pelan harian anda.`,
        zh: `${foodName} 已经在您的每日计划中了。`,
      };
      return { reply: alreadyInMessages[lang] };
    }
    return { reply: `${foodName} ${l.added}`, action: { type: "add", food: command.food } };
  }

  if (command.action === "remove") {
    const exists = cart.some(f => f.name.en === command.food!.name.en);
    if (!exists) {
      return { reply: l.notIn };
    }
    return { reply: `${command.food.name[lang] || command.food.name.en} ${l.removed}`, action: { type: "remove", food: command.food } };
  }

  return { reply: "Sorry, I didn't understand that." };
}

function formatFoodSuggestions(
  foods: FoodItem[],
  lang: LangCode,
  query: string | undefined,
  openFullLabels: Record<LangCode, string>
): ChatResponse {
  const choose = {
    en: "Did you mean one of these? You can pick one below:",
    ms: "Adakah anda maksudkan salah satu berikut? Pilih di bawah:",
    zh: "您是指以下哪一种？可在下方选择：",
  };
  const unavailablePrefix = { en: "Sorry,", ms: "Maaf,", zh: "抱歉，" };
  const unavailableSuffix = {
    en: "is not available in the food list.",
    ms: "tidak ada dalam senarai makanan.",
    zh: "不在食物列表中。",
  };
  const unavailableFoodName = formatUnavailableFoodName(query, lang);
  return {
    reply: unavailableFoodName
      ? `${unavailablePrefix[lang]} ${unavailableFoodName} ${unavailableSuffix[lang]}\n\n${choose[lang]}`
      : choose[lang],
    suggestions: foods,
    unavailableFoodName: unavailableFoodName || undefined,
    actionButton: foods.length > 0 ? { label: openFullLabels[lang], href: "/recommendation" } : undefined,
    isMultiFood: foods.length > 1,
  };
}

function isDailyIntakeQuestion(message: string, lang: LangCode): boolean {
  const lowerMsg = message.toLowerCase();
  const phrases = {
    en: [
      "how is my food plan",
      "is my food okay",
      "what did i eat",
      "did i exceed",
      "exceed anything",
      "daily intake",
      "today's intake",
      "todays intake",
      "food plan today",
      "my intake",
      "my food plan",
      "show my plan",
      "what is in my food plan",
    ],
    ms: [
      "pelan makanan saya",
      "pengambilan harian",
      "apa yang saya makan",
      "saya melebihi",
      "terlebih",
      "makanan saya hari ini",
    ],
    zh: [
      "每日摄入",
      "饮食计划",
      "今天吃了什么",
      "有没有超标",
      "超过限制",
      "食物计划",
    ],
  };

  return phrases[lang].some((phrase) => lowerMsg.includes(phrase));
}

function formatDailyIntakeSummary(summary: DailyIntakeSummary, lang: LangCode): string {
  const labels = {
    en: {
      empty: "Your daily plan is empty. Add foods from the food list first, then I can check your intake.",
      intro: `You currently have ${summary.foodCount} ${summary.foodCount === 1 ? "food" : "foods"} in your daily plan:`,
      title: "Today's intake summary:",
      sugar: "Sugar",
      fat: "Fat",
      sodium: "Sodium",
      calories: "Calories",
      within: "Within daily limit",
      exceededBy: "Exceeded by",
      warningsTitle: "Please take care:",
      tipsTitle: "Simple tips:",
      sodiumWarning: "High sodium may raise blood pressure",
      fatWarning: "High fat intake may increase cholesterol risk",
      sugarWarning: "High sugar may raise blood sugar",
      calorieWarning: "High calories may make weight control harder",
      sodiumTip: "Choose lower sodium foods later today",
      fatTip: "Reduce fried foods",
      sugarTip: "Drink plain water instead of sweet drinks",
      calorieTip: "Choose grilled or steamed foods",
      balancedTip: "Keep choosing simple, balanced portions today",
    },
    ms: {
      empty: "Pelan harian anda masih kosong. Tambah makanan daripada senarai makanan dahulu, kemudian saya boleh semak pengambilan anda.",
      intro: `Anda mempunyai ${summary.foodCount} makanan dalam pelan harian anda:`,
      title: "Ringkasan pengambilan hari ini:",
      sugar: "Gula",
      fat: "Lemak",
      sodium: "Natrium",
      calories: "Kalori",
      within: "Dalam had harian",
      exceededBy: "Melebihi sebanyak",
      warningsTitle: "Sila berhati-hati:",
      tipsTitle: "Tip mudah:",
      sodiumWarning: "Natrium tinggi boleh meningkatkan tekanan darah",
      fatWarning: "Lemak tinggi boleh meningkatkan risiko kolesterol",
      sugarWarning: "Gula tinggi boleh menaikkan gula darah",
      calorieWarning: "Kalori tinggi boleh menyukarkan kawalan berat badan",
      sodiumTip: "Pilih makanan rendah natrium selepas ini",
      fatTip: "Kurangkan makanan bergoreng",
      sugarTip: "Minum air kosong, bukan minuman manis",
      calorieTip: "Pilih makanan panggang atau kukus",
      balancedTip: "Teruskan pilih bahagian makanan yang seimbang hari ini",
    },
    zh: {
      empty: "您的每日计划还是空的。请先从食物列表添加食物，然后我可以帮您检查摄入情况。",
      intro: `您的每日计划中目前有 ${summary.foodCount} 个食物：`,
      title: "今日摄入总结：",
      sugar: "糖",
      fat: "脂肪",
      sodium: "钠",
      calories: "卡路里",
      within: "在每日限量内",
      exceededBy: "超出",
      warningsTitle: "请注意：",
      tipsTitle: "简单建议：",
      sodiumWarning: "钠摄入过高可能升高血压",
      fatWarning: "脂肪摄入过高可能增加胆固醇风险",
      sugarWarning: "糖摄入过高可能升高血糖",
      calorieWarning: "卡路里过高可能让体重控制更困难",
      sodiumTip: "今天接下来选择较低钠的食物",
      fatTip: "减少油炸食物",
      sugarTip: "喝白开水，少喝甜饮",
      calorieTip: "选择烤或蒸的食物",
      balancedTip: "今天继续保持简单均衡的份量",
    },
  };

  const l = labels[lang];
  if (summary.foodCount === 0) return l.empty;

  const status = (value: number, unit: "g" | "mg" | "kcal") =>
    value > 0 ? `${l.exceededBy} ${value}${unit}` : l.within;

  const warnings: string[] = [];
  const tips = new Set<string>();

  if (summary.excess.sodium > 0) {
    warnings.push(`⚠️ ${l.sodiumWarning}`);
    tips.add(l.sodiumTip);
  }
  if (summary.excess.fat > 0) {
    warnings.push(`⚠️ ${l.fatWarning}`);
    tips.add(l.fatTip);
    tips.add(l.calorieTip);
  }
  if (summary.excess.sugar > 0) {
    warnings.push(`⚠️ ${l.sugarWarning}`);
    tips.add(l.sugarTip);
  }
  if (summary.excess.cal > 0) {
    warnings.push(`⚠️ ${l.calorieWarning}`);
    tips.add(l.calorieTip);
  }
  if (tips.size === 0) {
    tips.add(l.balancedTip);
  }

  const foodList = summary.foodNames.map((name) => `• ${name}`).join("\n");
  const warningSection = warnings.length ? `\n\n${l.warningsTitle}\n${warnings.join("\n")}` : "";
  const tipSection = `\n\n${l.tipsTitle}\n${Array.from(tips).slice(0, 3).map((tip) => `• ${tip}`).join("\n")}`;

  return `${l.intro}

${foodList}

${l.title}

${l.sugar}: ${status(summary.excess.sugar, "g")}
${l.fat}: ${status(summary.excess.fat, "g")}
${l.sodium}: ${status(summary.excess.sodium, "mg")}
${l.calories}: ${status(summary.excess.cal, "kcal")}${warningSection}${tipSection}`;
}

function transformFoodRows(rows: FoodDataRow[]): FoodItem[] {
  const byId = new Map<number, FoodItem>()

  for (const row of rows) {
    if (row.food_id === null) continue

    if (!byId.has(row.food_id)) {
      const sugarVal  = row.sugar   ?? 0
      const fatVal    = row.fat     ?? 0
      const sodiumVal = row.sodium  ?? 0
      const giVal     = row.gi_value ?? 0

      let risk: "low" | "medium" | "high" = "low"
      if (sugarVal > 15 || fatVal > 15 || sodiumVal > 600 || giVal >= 70) {
        risk = "high"
      } else if (sugarVal > 5 || fatVal > 7 || sodiumVal > 200 || (giVal > 55 && giVal < 70)) {
        risk = "medium"
      }

      byId.set(row.food_id, {
        name:     { en: "", ms: "", zh: "" },
        category: row.food_type     ?? "",
        image:    row.image_url     ?? "",
        portion:  row.serving_size  ?? "",
        calories: String(row.calories  ?? 0),
        sugar:    `${row.sugar    ?? 0}g`,
        gi:       String(row.gi_value ?? 0),
        fat:      `${row.fat      ?? 0}g`,
        sodium:   `${row.sodium   ?? 0}mg`,
        risk,
        tip: { en: "", ms: "", zh: "" },
      })
    }

    const item = byId.get(row.food_id)!

    const lang = row.language as "en" | "ms" | "zh" | null
    if (lang === "en" || lang === "ms" || lang === "zh") {
      item.tip[lang] = row.health_tip ?? ""
      item.name[lang] = row.food_name ?? ""
    }
  }

  return Array.from(byId.values())
}

function normalizeFoodText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactFoodText(value: string): string {
  return normalizeFoodText(value).replace(/\s+/g, "");
}

function uniqueFoods(foods: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  return foods.filter((food) => {
    const key = food.name.en || `${food.name.ms}|${food.name.zh}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toLangCode(value: string | undefined): LangCode {
  return value === "ms" || value === "zh" ? value : "en";
}

// Split a query containing multiple food names joined by common separators.
// Returns an empty array when the input is clearly a single food name.
// NOTE: call this on the ORIGINAL message (before normalization) to preserve
// commas and other separators that normalizeFoodText would otherwise strip.
function splitMultipleFoodNames(query: string): string[] {
  const parts = query
    .split(
      /[,，；;\/或]|\s+(?:and|or|atau|&|plus|serta|dan|dengan|和|跟)\s+/gi
    )
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
  return parts.length > 1 ? parts : [];
}

// Try splitting on the normalized query first (conjunctions survive normalization).
// Fall back to the original message so commas/semicolons/slashes are not lost.
function resolveMultiFoodParts(originalMessage: string, normalizedQuery: string): string[] {
  const fromNormalized = splitMultipleFoodNames(normalizedQuery);
  if (fromNormalized.length > 1) return fromNormalized;

  const fromOriginal = splitMultipleFoodNames(originalMessage)
    .map((p) => stripFoodQuestionIntent(p))
    .filter((p) => p.length > 1);
  return fromOriginal.length > 1 ? fromOriginal : [];
}

function buildMultiFoodIntro(count: number, lang: LangCode): string {
  const labels: Record<LangCode, string> = {
    en: `Here is the health analysis for these ${count} foods:`,
    ms: `Berikut adalah analisis kesihatan untuk ${count} makanan ini:`,
    zh: `以下是这 ${count} 种食物的健康分析：`,
  };
  return labels[lang];
}

function detectUserMessageLanguage(message: string): LangCode | null {
  const normalized = normalizeFoodText(message);
  if (!normalized) return null;

  if (/[\u3400-\u9fff]/u.test(message)) return "zh";

  const malayMarkers = [
    "apa", "adakah", "bagaimana", "boleh", "makanan", "pilih", "daripada",
    "diimbas", "tekanan darah", "tinggi", "gula darah", "pemakanan", "hadkan",
    "kurangkan", "saya", "hari ini", "tiga tinggi",
  ];
  const englishMarkers = [
    "what", "which", "how", "is this", "can i", "should i", "food", "choose",
    "scanned menu", "daily food plan", "today", "diabetes", "blood pressure",
    "high cholesterol", "three highs", "limit", "avoid", "suitable",
  ];

  const hasMalay = malayMarkers.some((marker) => normalized.includes(marker));
  const hasEnglish = englishMarkers.some((marker) => normalized.includes(marker));

  if (hasMalay && !hasEnglish) return "ms";
  if (hasEnglish && !hasMalay) return "en";
  return null;
}

function getFoodNames(food: FoodItem): string[];
function getFoodNames(food: FoodItem): string[] {
  return [food.name.en, food.name.ms, food.name.zh].filter(Boolean);
}

/**
 * Extracts the food name from a natural-language cart command.
 *
 * Strategy:
 *   1. Find the action verb (add / remove / …) inside the message.
 *   2. Take the text AFTER the verb, strip trailing cart-noise → that is normally the food.
 *   3. If nothing useful is left after the verb (food was stated before it, e.g.
 *      "birthday cake, add to cart"), take the text BEFORE the verb and strip
 *      any leading conversational preamble.
 *   4. Last resort: strip both ends of the full message.
 *
 * This positional approach avoids the need for an exhaustive blocklist —
 * phrases like "help me", "kindly", "can you please" are automatically ignored
 * because they appear before the verb and we anchor extraction on the verb position.
 */
function stripCartIntent(message: string, action: "add" | "remove", lang: LangCode): string {
  const normalized = normalizeFoodText(message);
  if (!normalized) return "";

  const verbsByAction: Record<string, Record<string, string[]>> = {
    en: { add: ["add", "put", "insert", "include"], remove: ["remove", "delete"] },
    ms: { add: ["tambah", "masukkan"], remove: ["buang", "padam"] },
    zh: { add: ["添加", "加入", "放", "加"], remove: ["删除", "移除"] },
  };
  const verbs = verbsByAction[lang]?.[action] ?? [];

  const trailingFillers = [
    "into my food cart", "into food cart", "into the food cart", "into my cart", "into the cart",
    "into my daily plan", "into daily plan", "into the daily plan", "into my food plan", "into food plan",
    "to my food cart", "to food cart", "to the food cart", "to my cart", "to the cart",
    "to my daily plan", "to daily plan", "to the daily plan", "to my food plan",
    "from my daily plan", "from daily plan", "from my food plan",
    "my daily plan", "my food plan", "my cart",
    "food plan", "daily plan", "food cart",
    "into cart", "to cart", "from cart",
    "into", "to", "the", "cart",
    "ke pelan harian saya", "daripada pelan harian saya", "pelan harian saya",
    "ke troli makanan saya", "ke troli saya", "dalam troli saya",
    "pelan harian", "troli",
    "加入我的每日计划", "从我的每日计划", "我的每日计划", "每日计划",
    "加入我的购物车", "加入购物车", "放入购物车", "购物车", "到",
  ];

  const leadingFillers = [
    "can you please", "could you please",
    "i would like to", "i would like",
    "i d like to", "i d like",
    "i want to", "i want",
    "can you", "could you",
    "how about", "what about",
    "please", "pls", "help me", "kindly",
    "boleh tolong", "boleh tak", "boleh",
    "tolong", "sila",
    "请帮我", "帮我", "请",
  ];

  const stopwordsByLang: Record<LangCode, Set<string>> = {
    en: new Set([
      "add", "remove", "put", "insert", "include",
      "help", "me", "please", "pls", "can", "you", "i", "want",
      "into", "to", "the", "my", "in", "on", "from",
      "cart", "food", "daily", "plan",
    ]),
    ms: new Set(["tambah", "masukkan", "buang", "padam", "tolong", "sila", "ke", "dalam", "daripada", "troli", "pelan", "harian"]),
    zh: new Set(["请", "帮我", "添加", "加入", "放", "删除", "移除", "到", "购物车", "每日计划"]),
  };

  function stripTrailing(text: string): string {
    let s = text.trim();
    let changed = true;
    while (changed) {
      changed = false;
      for (const filler of trailingFillers) {
        const nf = normalizeFoodText(filler);
        if (!nf) continue;
        if (hasCjk(nf)) {
          if (s.endsWith(nf)) {
            s = s.slice(0, s.length - nf.length).trim();
            changed = true;
          }
        } else {
          const next = s.replace(new RegExp(`(?:^|\\s)${escapeRegExp(nf)}$`, "u"), "").trim();
          if (next !== s) {
            s = next;
            changed = true;
          }
        }
      }
    }
    return s;
  }

  function stripLeading(text: string): string {
    let s = text.trim();
    let changed = true;
    while (changed) {
      changed = false;
      for (const filler of leadingFillers) {
        const nf = normalizeFoodText(filler);
        if (!nf) continue;
        if (hasCjk(nf)) {
          if (s.startsWith(nf)) {
            s = s.slice(nf.length).trim();
            changed = true;
          }
        } else {
          const next = s.replace(new RegExp(`^${escapeRegExp(nf)}(?=\\s|$)`, "u"), "").trim();
          if (next !== s) {
            s = next;
            changed = true;
          }
        }
      }
    }
    return s;
  }

  function dropStopwords(candidate: string): string {
    if (!candidate) return "";
    if (lang === "zh" || hasCjk(candidate)) return candidate;
    const stopwords = stopwordsByLang[lang];
    return candidate
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && !stopwords.has(token))
      .join(" ")
      .trim();
  }

  function cleanCandidate(text: string): string {
    const compact = dropStopwords(stripLeading(stripTrailing(text)));
    return compact.replace(/\s+/g, " ").trim();
  }

  // Find earliest action verb occurrence in the message.
  let verbStart = -1;
  let verbEnd = -1;
  for (const verb of verbs) {
    const nv = normalizeFoodText(verb);
    if (!nv) continue;
    if (hasCjk(nv)) {
      const idx = normalized.indexOf(nv);
      if (idx !== -1 && (verbStart === -1 || idx < verbStart)) {
        verbStart = idx;
        verbEnd = idx + nv.length;
      }
    } else {
      const re = new RegExp(`(^|\\s)(${escapeRegExp(nv)})(?=\\s|$)`, "u");
      const m = re.exec(normalized);
      if (m) {
        const idx = m.index + m[1].length;
        if (verbStart === -1 || idx < verbStart) {
          verbStart = idx;
          verbEnd = idx + nv.length;
        }
      }
    }
  }

  if (verbEnd !== -1) {
    const afterVerb = cleanCandidate(normalized.slice(verbEnd).trim());
    if (afterVerb.length >= 2) return afterVerb;

    const beforeVerb = cleanCandidate(normalized.slice(0, verbStart).trim());
    if (beforeVerb.length >= 2) return beforeVerb;
  }

  return cleanCandidate(normalized);
}

/**
 * Strips question wrappers and conversational / cart-style prefixes so the food
 * matcher receives a real dish name (e.g. "那幫我加拉茶" → "拉茶").
 */
function extractFoodQueryCandidate(message: string): string {
  let normalized = stripFoodQuestionIntent(message);
  if (!normalized) return "";

  const leadingJunk = [
    "help me analyze",
    "help me analyse",
    "help me check",
    "help me",
    "can you please analyze",
    "can you please analyse",
    "can you analyze",
    "can you analyse",
    "could you analyze",
    "could you analyse",
    "please analyze",
    "please analyse",
    "please check",
    "analyze the",
    "analyze my",
    "analyze this",
    "analyze",
    "analyse the",
    "analyse my",
    "analyse this",
    "analyse",
    "check the",
    "check my",
    "check this",
    "check",
    "can you check",
    "could you check",
    "那帮我分析",
    "那幫我分析",
    "请帮我分析",
    "請幫我分析",
    "帮我分析",
    "幫我分析",
    "请分析",
    "請分析",
    "分析",
    "那帮我加",
    "那幫我加",
    "那请帮我加",
    "那請幫我加",
    "请帮我加",
    "請幫我加",
    "帮我加",
    "幫我加",
    "请加",
    "請加",
    "请把",
    "請把",
    "麻烦加",
    "麻煩加",
    "帮我",
    "幫我",
    "请",
    "請",
    "那麼",
    "那么",
    "那",
    "我想问",
    "我想問",
    "想问",
    "想問",
    "我想了解",
    "想了解",
    "我想知道",
    "想知道",
    "我想吃",
    "想吃",
    "我要吃",
    "要吃",
    "能不能吃",
    "可以吃吗",
    "可以吃嗎",
    "可不可以吃",
    "能吃吗",
    "能吃嗎",
    "tolong tambah",
    "boleh tambah",
    "sila tambah",
    "can you add",
    "please add",
    "could you add",
    "kindly add",
    // Intake-intent prefixes: "i want to eat X", "want to try X", etc.
    "i would like to eat",
    "i would like to have",
    "i would like to try",
    "i would like",
    "i want to eat",
    "i want to have",
    "i want to try",
    "i feel like eating",
    "i feel like having",
    "i feel like",
    "i am going to eat",
    "i am going to have",
    "i will eat",
    "i will have",
    "i will try",
    "let me eat",
    "going to eat",
    "going to have",
    "want to eat",
    "want to have",
    "want to try",
    "want to check",
    "i want",
    "saya nak makan",
    "saya mahu makan",
    "saya nak",
    "saya mahu",
    "ingin makan",
    "nak makan",
    "mahu makan",
    "what about eating",
    "how about eating",
    "what about having",
    "how about having",
    "what about trying",
    "how about trying",
    "what about",
    "how about",
  ].sort((a, b) => normalizeFoodText(b).length - normalizeFoodText(a).length);

  const trailingJunk = [
    "not available though",
    "not available",
    "though",
    // Health-assessment adjectives must NOT become part of the food name
    "healthy or not",
    "safe or not",
    "good or not",
    "healthy",
    "unhealthy",
    "healthier",
    "unhealthier",
    "safe",
    "unsafe",
    "good",
    "bad",
    "okay",
    "ok",
    "or not",
    "健康吗",
    "健康嗎",
    "健康不",
    "怎么样",
    "怎麼樣",
    "行不行",
    "可以吗",
    "可以嗎",
    "好吗",
    "好嗎",
    "谢谢",
    "謝謝",
    "多谢",
    "多謝",
  ].sort((a, b) => normalizeFoodText(b).length - normalizeFoodText(a).length);

  let changed = true;
  while (changed) {
    changed = false;
    const before = normalized;
    for (const phrase of leadingJunk) {
      const np = normalizeFoodText(phrase);
      if (!np) continue;
      if (hasCjk(np)) {
        if (normalized.startsWith(np)) {
          normalized = normalized.slice(np.length).trim();
          changed = true;
          break;
        }
      } else if (normalized.startsWith(np)) {
        normalized = normalized.slice(np.length).trim();
        changed = true;
        break;
      }
    }
    if (before === normalized) break;
  }

  changed = true;
  while (changed) {
    changed = false;
    const before = normalized;
    for (const phrase of trailingJunk) {
      const np = normalizeFoodText(phrase);
      if (!np) continue;
      if (hasCjk(np)) {
        if (normalized.endsWith(np)) {
          normalized = normalized.slice(0, normalized.length - np.length).trim();
          changed = true;
          break;
        }
      } else if (normalized.endsWith(np)) {
        normalized = normalized.slice(0, normalized.length - np.length).trim();
        changed = true;
        break;
      }
    }
    if (before === normalized) break;
  }

  if (!hasCjk(normalized)) {
    const commandTokens = new Set([
      "help",
      "me",
      "analyze",
      "analyse",
      "analysis",
      "check",
      "please",
      "can",
      "could",
      "you",
      "the",
      "my",
      "this",
      "that",
      "food",
      // Intake-intent tokens ("i want to eat X" → "X")
      "i",
      "want",
      "to",
      "eat",
      "eating",
      "have",
      "having",
      "try",
      "trying",
    ]);
    let tokens = normalized.split(" ").filter(Boolean);
    while (tokens.length > 0 && commandTokens.has(tokens[0]!)) {
      tokens = tokens.slice(1);
    }
    normalized = tokens.join(" ");
  }

  return normalized.replace(/\s+/g, " ").trim();
}

const CONVERSATIONAL_PHRASES_EXACT = new Set(
  [
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
    "what does this mean",
    "never mind",
    "nevermind",
    "i see",
    "got it",
    "understood",
    "tidak ada",
    "tak ada",
    "kenapa",
    "salah",
    "cuba lagi",
    "好的",
    "为什么",
    "不对",
    "再试",
    "什么意思",
    "dont talk to me",
    "don't talk to me",
    "pmg",
  ].map(normalizeFoodText)
);

/** Follow-up about risk / meaning — not generic chit-chat; may use prior scan context. */
function isFoodFollowUpQuestion(message: string): boolean {
  const n = normalizeFoodText(message);
  if (!n) return false;
  if (
    /\bwhy\b.*\b(risk|sugar|sodium|salt|fat|calorie|calories|high|low|gi|healthy|unhealthy)\b/u.test(n)
  ) {
    return true;
  }
  if (/\bwhy\b.*\b(so|is)\b.*\b(high|low|medium)\b/u.test(n)) return true;
  if (/\bwhat (does|do) (this|that|it) mean\b/u.test(n)) return true;
  if (/^what does this mean/u.test(n)) return true;
  if (/\bhow (come|is)\b/u.test(n) && /\b(risk|high|low|sugar|sodium)\b/u.test(n)) return true;
  if (/为什么.*(风险|糖|钠|盐|脂肪|高|低|意思)/u.test(n)) return true;
  if (/什么意思/u.test(n) && n.length < 36) return true;
  if (/kenapa.*(risiko|tinggi|gula|natrium)/u.test(n)) return true;
  return false;
}

function isCasualAcknowledgement(message: string): boolean {
  const n = normalizeFoodText(message);
  if (!n || isFoodFollowUpQuestion(message)) return false;
  const exact = new Set(
    [
      "ok",
      "okay",
      "k",
      "kk",
      "thanks",
      "thank you",
      "ty",
      "thx",
      "cheers",
      "i see",
      "got it",
      "understood",
      "fine",
      "sure",
      "cool",
      "nice",
      "great",
      "good",
      "yes",
      "yep",
      "yeah",
      "好的",
      "明白",
      "谢谢",
      "多谢",
      "嗯",
      "好",
      "行",
      "知道了",
    ].map(normalizeFoodText)
  );
  if (exact.has(n)) return true;
  if (/^(thanks|thank you|ty|thx)(\s+!)?$/u.test(n)) return true;
  if (/^(thank you)( very much| so much)$/u.test(n)) return true;
  return false;
}

function isComplaintOrClarification(message: string): boolean {
  const n = normalizeFoodText(message);
  if (!n || isFoodFollowUpQuestion(message) || isCasualAcknowledgement(message)) return false;
  if (
    /\b(not available|not working|not showing|not right|cannot see|cant see|doesnt work|don't work)\b/u.test(
      n
    )
  ) {
    return true;
  }
  if (/\b(wrong|error|broken|missing|bug)\b/u.test(n)) return true;
  if (/\b(salah|tidak|rosak|tidak boleh)/u.test(n)) return true;
  if (/\b(不对|不行|没有|故障|不显示)/u.test(n)) return true;
  if (/\bthough$/u.test(n) && n.length < 48) return true;
  return false;
}

/** Food-analysis intent but no dish named (this/that/healthy). */
function isVagueFoodAnalysisIntent(message: string): boolean {
  const n = normalizeFoodText(message);
  if (!n || isFoodFollowUpQuestion(message) || isCasualAcknowledgement(message) || isComplaintOrClarification(message)) {
    return false;
  }
  if (isVagueFoodQuestion(message)) return true;
  if (
    /\b(analyze this|analyse this|check this food|check this|this food|that food|these foods|is this healthy|is it healthy|is this okay|can you analyze|can you analyse|help me analyze|help me analyse)\b/u.test(
      n
    )
  ) {
    return true;
  }
  if (/分析(这个|那种)|检查(这个|这)|这个.*健康|可不可以吃/u.test(n)) return true;
  if (/\b(boleh semak|analisis ini|semak ini)\b/u.test(n)) return true;
  return false;
}

function scanContextSummaryLines(scanContext: NonNullable<ChatRequest["scanContext"]>): string {
  const lines: string[] = [];
  for (const cat of ["Appetizer", "Main Dish", "Dessert", "Drinks"] as const) {
    const ranking = scanContext[cat]?.ranking;
    if (!ranking?.length) continue;
    for (const item of ranking) {
      const tip =
        typeof item.tip === "object" && item.tip !== null && "en" in item.tip
          ? String((item.tip as { en?: string }).en ?? "").slice(0, 120)
          : String(item.tip ?? "").slice(0, 120);
      lines.push(
        `- ${item.f} (${cat}): risk ${item.risk}. Sugar ${item.sugar}g, sodium ${item.salt}mg, fat ${item.fat}g.${tip ? ` Tip: ${tip}` : ""}`
      );
    }
  }
  return lines.join("\n");
}

function buildBriefChitChatSystemPrompt(language: LangCode): string {
  const langInstructions: Record<LangCode, string> = {
    en: "Respond entirely in English.",
    ms: "Jawab sepenuhnya dalam Bahasa Malaysia.",
    zh: "请完全使用简体中文回答。",
  };
  return `You are Siti, a friendly SIHAT health assistant.

${langInstructions[language]}

The user sent a very short message (for example okay, thanks, or never mind). It is NOT asking to analyze food by name.

Reply in ONE short sentence, warm and natural. Do NOT ask which food or drink to check. Do NOT mention pizza, menus, or analysis unless the user did.`;
}

function buildFollowUpSystemPrompt(
  language: LangCode,
  scanContext: NonNullable<ChatRequest["scanContext"]>
): string {
  const langInstructions: Record<LangCode, string> = {
    en: "Respond entirely in English.",
    ms: "Jawab sepenuhnya dalam Bahasa Malaysia.",
    zh: "请完全使用简体中文回答。",
  };
  const summary = scanContextSummaryLines(scanContext);
  return `You are Siti, a friendly SIHAT health assistant for elderly users in Malaysia.

${langInstructions[language]}

The user previously viewed this food analysis (from their menu scan or full analysis). They are asking a FOLLOW-UP question — not naming a new dish.

PREVIOUS ITEMS (only reference these; do not invent other foods):
${summary}

Instructions:
- Answer in 2–3 short sentences, plain language.
- Explain risk or wording they asked about using only the items above.
- Do not repeat a full nutrition table.
- Do not ask which food to check unless nothing is listed above (should not happen).
- No medical diagnosis or medication advice.`;
}

function casualAcknowledgementReply(lang: LangCode, seed: string): string {
  const en = ["No problem.", "Glad I could help.", "Okay.", "You're welcome.", "Happy to help."];
  const ms = ["Tiada masalah.", "Senang dapat membantu.", "Okay.", "Sama-sama.", "Dengan senang hati."];
  const zh = ["不客气。", "很高兴能帮到您。", "好的。", "没问题。", "很高兴为您服务。"];
  const idx = Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % en.length;
  if (lang === "ms") return ms[idx]!;
  if (lang === "zh") return zh[idx]!;
  return en[idx]!;
}

function complaintClarificationReply(lang: LangCode): string {
  const labels: Record<LangCode, string> = {
    en: "Could you tell me which food or part of the app you mean? I will try to help.",
    ms: "Boleh beritahu saya makanan atau bahagian aplikasi yang dimaksudkan? Saya akan cuba membantu.",
    zh: "您指的是哪种食物或哪个功能？请告诉我，我尽量帮您。",
  };
  return labels[lang];
}

function followUpWithoutContextReply(lang: LangCode): string {
  const labels: Record<LangCode, string> = {
    en: "Which food would you like me to explain?",
    ms: "Makanan manakah yang anda mahu saya terangkan?",
    zh: "您想让我解释哪一种食物？",
  };
  return labels[lang];
}

/** Meta / feedback — not food names; must not become food cards or AI estimates. */
function isConversationalOnlyMessage(text: string): boolean {
  if (isFoodFollowUpQuestion(text)) return false;
  const n = normalizeFoodText(text);
  if (!n) return true;
  if (CONVERSATIONAL_PHRASES_EXACT.has(n)) return true;

  const patterns = [
    /^not available\b/u,
    /\bthough$/u,
    /^what do you mean/u,
    /^what does this mean/u,
    /^that is wrong/u,
    /^thats wrong/u,
    /^why though/u,
    /^ok but/u,
    /^but why/u,
    /^still not/u,
    /^it is wrong/u,
    /^its wrong/u,
    /^不对/u,
    /^为什么/u,
    /^什么意思/u,
    /^再试/u,
    /^没有/u,
    /^不可用/u,
    /^who am i\b/u,
    /^what am i\b/u,
    /^where am i\b/u,
    /^what is this\b/u,
    /^what is that\b/u,
    /^can you help me\b/u,
    /^dont talk\b/u,
    /^don't talk\b/u,
    /\bdont talk to me\b/u,
    /\bdon't talk to me\b/u,
    /^leave me alone\b/u,
    /^stop talking\b/u,
    /^go away\b/u,
  ];
  if (patterns.some((p) => p.test(n))) return true;

  const tokens = n.split(" ").filter(Boolean);
  if (
    tokens.length <= 4 &&
    /\b(why|wrong|available|mean|again|though|help)\b/u.test(n) &&
    !/\b(nasi|teh|milo|rice|lemak|tarik|makanan|cendol|pizza)\b/u.test(n)
  ) {
    return true;
  }

  return false;
}

/**
 * Message tokens that are never a food/dish name by themselves — used to reject
 * “who am i”, “ok thanks”, etc. from bare short-text food inference.
 */
const GENERIC_NON_FOOD_TOKENS = new Set(
  [
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "am",
    "be",
    "been",
    "being",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "can",
    "may",
    "might",
    "must",
    "i",
    "im",
    "you",
    "u",
    "we",
    "they",
    "it",
    "me",
    "my",
    "your",
    "yours",
    "this",
    "that",
    "these",
    "those",
    "who",
    "whom",
    "whose",
    "what",
    "which",
    "why",
    "how",
    "when",
    "where",
    "there",
    "here",
    "not",
    "no",
    "yes",
    "ok",
    "okay",
    "thanks",
    "thank",
    "sorry",
    "hello",
    "hi",
    "hey",
    "bye",
    "good",
    "morning",
    "afternoon",
    "evening",
    "night",
    "fine",
    "well",
  ].map(normalizeFoodText)
);

function tokensAreOnlyGenericNonFood(phrase: string): boolean {
  const tokens = normalizeFoodText(phrase)
    .split(" ")
    .filter(Boolean);
  return tokens.length > 0 && tokens.every((tok) => GENERIC_NON_FOOD_TOKENS.has(tok));
}

const TYPED_FOOD_STOPWORDS = new Set(
  [
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "this",
    "that",
    "it",
    "my",
    "your",
    "please",
    "help",
    "me",
    "you",
    "can",
    "could",
    "should",
    "would",
    "do",
    "does",
    "did",
    "how",
    "why",
    "what",
    "when",
    "where",
    "which",
    "about",
    "for",
    "with",
    "and",
    "or",
    "not",
    "available",
    "though",
    "again",
    "wrong",
    "mean",
    "tell",
    "explain",
    "compare",
    "versus",
    "vs",
    "boleh",
    "saya",
    "tolong",
    "请",
    "帮",
    "幫",
  ].map(normalizeFoodText)
);

/** Gate AI-estimated cards: only when the extracted string plausibly names food/drink. */
function looksLikePlausibleFoodName(name: string): boolean {
  const n = normalizeFoodText(name);
  if (!n || isConversationalOnlyMessage(n)) return false;
  if (tokensAreOnlyGenericNonFood(n)) return false;

  if (/\b(help|analyze|analyse|check|scan|menu|please|boleh|tambah|compare)\b/u.test(n)) {
    return false;
  }

  if (isFoodFollowUpQuestion(n)) return false;

  if (hasCjk(n)) {
    return n.length >= 2 && n.length <= 16;
  }

  const tokens = n.split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 6) return false;
  if (tokens.every((t) => TYPED_FOOD_STOPWORDS.has(t))) return false;
  if (tokens.length === 1 && TYPED_FOOD_STOPWORDS.has(tokens[0]!)) return false;

  return n.length >= 2 && n.length <= 48;
}

/** 3-letter (or shorter) tokens that are still credible dishes/drinks alone. */
const SHORT_REAL_FOOD_TOKENS = new Set(
  ["teh", "mee", "kui", "egg", "pis", "bao", "tau", "rot", "pho"].map(normalizeFoodText)
);

/**
 * Strict gate for AI-generated food cards only (DB matches use matchFoodQuery only).
 * Uncertain → false (no card; caller may send clarification).
 * Plurals like cookies/biscuits/chips/crackers are included explicitly.
 */
const REAL_FOOD_LEXEME_RE =
  /\b(pizza|burgers?|fried\s*rice|chicken\s*rice|hainanese|rice|fried|cendol|chendol|teh\s*o|teh\s*tarik|tarik|limau|bandung|kopi|roti|canai|mee|maggie|maggi|curry|soups?|sate|satay|laksa|porridge|noodles?|wontons?|wantans?|dumplings?|chicken|beef|fish|shrimp|prawns?|crabs?|cakes?|bread|toast|sandwiches?|salads?|pasta|steak|sushi|ramen|pho|pie|dim\s*sum|char\s*kuey|kuey\s*teow|kuay\s*teow|bee\s*hoon|bihun|rendang|ketupat|lemang|biryani|dhal|dhall|idli|thosai|milo|horlicks|juice|cola|soda|coffee|tea|tea\s*o|latte|espresso|bubble|boba|cheese|nasi|lemak|nasi\s*lemak|porridge|congee|goreng|kaya|popiah|rojak|ais\s*kacang|ice\s*kacang|murtabak|pisang|tahu|tauhu|daging|ayam|ikan|sotong|udang|nuggets?|wings?|waffles?|pancakes?|croissants?|donuts?|doughnuts?|muffins?|smoothie|milkshake|yogurt|yoghurt|cereal|oats|granola|spring\s*rolls?|egg\s*tart|custard|custard\s*bun|bao\s*pau|mantou|longan|lychee|rambutan|durian|mango|papaya|coconut|tempeh|tofu|quinoa|couscous|burritos?|tacos?|quesadillas?|nachos?|falafel|hummus|wraps?|bagels?|pretzels?|crackers?|biscuits?|cookies?|brownies?|macaron|macaroons?|gelato|sorbet|churros?|kimchi|bibimbap|bulgogi|gyoza|edamame|poke|poutine|bruschetta|ravioli|gnocchi|lasagna|paella|frittata|omelette|omelet|crepe|scone|rolls?|sub|hoagie|kebabs?|shawarma|samosas?|pakora|pulut|ketupat|lontong|nasi\s*kandar|nasi\s*dagang|nasi\s*kerabu|lemper|kuih|pulut|tapai|cincau|soya|soy\s*milk|almond\s*milk|oat\s*milk|grass\s*jelly|bubble\s*tea|bbt|milk\s*tea|fruit\s*juice|orange\s*juice|apple\s*juice|celery\s*juice|carrot\s*juice|barley|chrysanthemum|wintermelon|sugarcane|sugar\s*cane|air\s*tebu|sirap\s*bandung|teh\s*ping|ais\s*limau|teh\s*ais|chips?)\b/iu;

function latinLettersOnly(s: string): string {
  return s.replace(/[^a-z]/gi, "");
}

function latinTokenHasVowelLetters(s: string): boolean {
  return /[aeiouy]/i.test(latinLettersOnly(s));
}

function looksLikeLatinGibberishToken(token: string): boolean {
  if (hasCjk(token)) return false;
  const letters = latinLettersOnly(token);
  if (letters.length < 2) return false;
  if (letters.length <= 5 && !latinTokenHasVowelLetters(token)) return true;
  if (letters.length >= 3 && /^(.)\1{2,}$/i.test(letters)) return true;
  return false;
}

function looksLikeRandomLetterGibberishPhrase(n: string): boolean {
  const tokens = n.split(/\s+/).filter(Boolean);
  return tokens.some((tok) => looksLikeLatinGibberishToken(tok));
}

const COMMAND_ONLY_CANDIDATE_PHRASES = new Set(
  [
    "help me",
    "analyze this",
    "analyse this",
    "check this",
    "help me analyze",
    "help me analyse",
    "help me check",
  ].map(normalizeFoodText)
);

/**
 * Before AI fallback: true only when the candidate is likely a real food/drink name.
 */
function isLikelyRealFoodName(candidate: string, _originalMessage: string): boolean {
  const n = normalizeFoodText(candidate);
  if (!n) return false;
  if (isConversationalOnlyMessage(n)) return false;
  if (tokensAreOnlyGenericNonFood(n)) return false;

  if (COMMAND_ONLY_CANDIDATE_PHRASES.has(n)) return false;

  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => GENERIC_NON_FOOD_TOKENS.has(t))) {
    return false;
  }

  if (/\b(who|whom|what|which|why|how|when|where)\b/i.test(n) && !hasFoodLexeme(n)) {
    return false;
  }
  if (/\b(am i|are you|is this|was i)\b/i.test(n)) return false;

  if (hasCjk(n)) {
    return n.length >= 2 && n.length <= 24;
  }

  if (hasFoodLexeme(n)) return true;

  if (looksLikeRandomLetterGibberishPhrase(n)) return false;

  const compact = n.replace(/\s+/g, "");
  if (compact.length < 4) {
    return tokens.length === 1 && SHORT_REAL_FOOD_TOKENS.has(tokens[0]!);
  }

  const latinTokens = tokens.filter((t) => /[a-z]/i.test(t) && !hasCjk(t));
  if (latinTokens.length > 0 && !latinTokens.some((t) => latinTokenHasVowelLetters(t))) {
    return false;
  }

  return true;
}

type ChatIntent = "food_analysis_request" | "normal_chat" | "follow_up_question";

const NON_FOOD_CHAT_TOKENS = new Set(
  ["dont", "don't", "talk", "stop", "leave", "alone", "away", "pmg", "abc", "qwe"].map(normalizeFoodText)
);

/** Social / meta phrases that must never enter food-analysis (default is normal_chat). */
function isExplicitNormalChatMessage(message: string): boolean {
  const n = normalizeFoodText(message);
  if (!n) return true;

  const patterns = [
    /^dont talk\b/u,
    /^don't talk\b/u,
    /\bdont talk to me\b/u,
    /\bdon't talk to me\b/u,
    /^leave me alone\b/u,
    /^stop talking\b/u,
    /^go away\b/u,
    /^talk to me\b/u,
    /^who am i\b/u,
    /^what am i\b/u,
    /^where am i\b/u,
    /^pmg$/u,
    /^abc$/u,
    /^qwe$/u,
  ];
  if (patterns.some((p) => p.test(n))) return true;

  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && looksLikeLatinGibberishToken(tokens[0]!) && !hasFoodLexeme(n)) {
    return true;
  }
  if (
    tokens.length >= 2 &&
    tokens.length <= 6 &&
    tokens.every((t) => GENERIC_NON_FOOD_TOKENS.has(t) || NON_FOOD_CHAT_TOKENS.has(t))
  ) {
    return true;
  }
  return false;
}

const FOOD_ANALYSIS_VERB_RE =
  /\b(analyze|analyse|analysis|check|compare|contrast|scan|menu|versus|vs\b|healthy|unhealthier|unhealthy|nutrition|nutrient|calorie|calories|\bgi\b|glycemic|sugar|sodium|salt|\bfat\b|cholesterol|fiber|fibre|eat|drink|makan|minum|makanan|minuman|meal|snack|dish|食物|分析|健康|营养|热量|糖|钠|脂肪|可以吃|能不能吃|可不可以吃|能吃吗|安全吗|boleh makan|semak|analisis)\b/iu;

const DISH_OR_DRINK_HINT_RE =
  /\b(nasi|lemak|pizza|cendol|teh|tarik|kopi|roti|canai|mee|maggie|maggi|rice|fried|cake|bread|egg|curry|soups?|sate|satay|burgers?|cola|juice|ais|limau|bandung|laksa|porridge|noodles?|wontons?|dumplings?|tahu|tauhu|rendang|ketupat|lemang|biryani|hainanese|toast|sandwiches?|ramen|pho|sushi|steak|pasta|salads?|oats|milo|horlicks|soya|soy|char\s+kuey|dim\s*sum|cookies?|biscuits?|crackers?|chips?)\b/iu;

/**
 * Test a normalised string (or its token-by-token de-pluralised form) against
 * the food lexeme regexes.  Handles cookies→cookie, biscuits→biscuit, etc.
 */
function hasFoodLexeme(n: string): boolean {
  if (REAL_FOOD_LEXEME_RE.test(n) || DISH_OR_DRINK_HINT_RE.test(n)) return true;
  // Strip common English plural suffixes token-by-token and retest.
  const depluralised = n
    .replace(/\b([a-z]{3,})ies\b/gi, "$1y")   // cookies? no — "y" forms
    .replace(/\b([a-z]{4,})es\b/gi, "$1")     // sandwiches → sandwich
    .replace(/\b([a-z]{4,})s\b/gi, "$1");     // biscuits → biscuit, chips → chip
  return depluralised !== n &&
    (REAL_FOOD_LEXEME_RE.test(depluralised) || DISH_OR_DRINK_HINT_RE.test(depluralised));
}

/** Positive food-analysis intent only — never default true for unknown text. */
function isFoodAnalysisRequestIntent(message: string): boolean {
  const n = normalizeFoodText(message);
  if (!n || n.length > 120) return false;
  if (isExplicitNormalChatMessage(message)) return false;

  const dishLexeme = hasFoodLexeme(n);
  const analysisVerb = FOOD_ANALYSIS_VERB_RE.test(n);

  if (
    /\b(is|are|can i|should i|boleh|adakah)\b/iu.test(n) &&
    /\b(healthy|safe|okay|ok|eat|makan|吃|营养|健康)\b/iu.test(n) &&
    dishLexeme
  ) {
    return true;
  }

  if (analysisVerb && dishLexeme) return true;

  if (analysisVerb && /\b(this|that|it)\b/u.test(n) && n.split(/\s+/).filter(Boolean).length <= 5) {
    return false;
  }

  const tokens = n.split(/\s+/).filter(Boolean);
  if (dishLexeme && tokens.length >= 1 && tokens.length <= 5) {
    // Block genuine interrogative openers, but NOT "how about X" / "what about X"
    // which are analysis-request prefixes (also stripped as leadingJunk in extraction).
    if (/^(who|whom|why|when|where|which|dont|don't|stop)\b/i.test(n)) return false;
    if (/^(what|how)\b/i.test(n) && !/^(what about|how about)\b/i.test(n)) return false;
    if (tokens.every((t) => GENERIC_NON_FOOD_TOKENS.has(t))) return false;
    if (tokens.length === 1 && looksLikeLatinGibberishToken(tokens[0]!) && !hasFoodLexeme(n)) {
      return false;
    }
    if (hasCjk(n) && !hasFoodLexeme(n)) {
      return /[\u4e00-\u9fff]{1,}(面|饭|茶|汤|肉|菜|糕|饼|粥|饺|包|饮|奶|糖)/u.test(n);
    }
    return true;
  }

  return false;
}

/**
 * True when the message is explicitly conversational / non-food by known pattern.
 * These messages must NEVER be promoted to food_analysis_request even if the DB
 * pre-check somehow produces a spurious candidate match.
 */
function isDefinitelyNonFoodMessage(message: string): boolean {
  return (
    isConversationalOnlyMessage(message) ||
    isCasualAcknowledgement(message) ||
    isComplaintOrClarification(message) ||
    isExplicitNormalChatMessage(message)
  );
}

/**
 * Classify user message before any food extraction or AI food cards.
 * Default is normal_chat — food analysis is opt-in via positive signals only.
 */
function classifyChatIntent(message: string): ChatIntent {
  if (isFoodFollowUpQuestion(message)) return "follow_up_question";
  if (isConversationalOnlyMessage(message)) return "normal_chat";
  if (isCasualAcknowledgement(message)) return "normal_chat";
  if (isComplaintOrClarification(message)) return "normal_chat";
  if (isExplicitNormalChatMessage(message)) return "normal_chat";
  if (isFoodAnalysisRequestIntent(message)) return "food_analysis_request";
  return "normal_chat";
}

function messageIndicatesFoodRelatedQuery(message: string): boolean {
  return classifyChatIntent(message) === "food_analysis_request";
}

/**
 * STEP 1 — Pull dish/drink names from typed text (never return raw full sentences).
 * Caller must only invoke when classifyChatIntent === food_analysis_request.
 */
function extractFoodNamesFromMessage(message: string): string[] {
  if (classifyChatIntent(message) !== "food_analysis_request") return [];

  const candidate = extractFoodQueryCandidate(message);
  if (!candidate) return [];

  const multi = resolveMultiFoodParts(message, candidate);
  if (multi.length > 1) {
    return multi
      .map((part) => extractFoodQueryCandidate(part))
      .filter((part) => part.length >= 2 && looksLikePlausibleFoodName(part));
  }

  if (!looksLikePlausibleFoodName(candidate)) return [];
  return [candidate];
}

function whichFoodClarificationReply(lang: LangCode): string {
  const labels: Record<LangCode, string> = {
    en: "Which food or drink would you like me to check?",
    ms: "Makanan atau minuman apa yang anda mahu saya semak?",
    zh: "您想让我分析哪一种食物或饮料？",
  };
  return labels[lang];
}

/** When extraction looked food-like but the term is not a credible dish/drink name for AI. */
function couldYouSpecifyFoodNameReply(lang: LangCode): string {
  const labels: Record<LangCode, string> = {
    en: "Could you tell me the food or drink name you want me to check?",
    ms: "Boleh beritahu nama makanan atau minuman yang anda mahu saya semak?",
    zh: "请告诉我您希望我来分析的食物或饮料名称好吗？",
  };
  return labels[lang];
}

function isVagueFoodQuestion(message: string): boolean {
  const n = normalizeFoodText(message);
  if (!n || isConversationalOnlyMessage(n)) return false;
  return (
    /\b(healthy|health|safe|eat|drink|food|nutrition|compare|makanan|minuman|营养|健康|可以吃|能不能吃)\b/u.test(
      n
    ) || /(is|are|can i|should i|boleh|adakah).{0,40}(eat|makan|吃)/u.test(n)
  );
}

function stripFoodQuestionIntent(message: string): string {
  let normalized = normalizeFoodText(message);
  const wrappers = [
    "is",
    "are",
    "this",
    "food",
    "okay",
    "ok",
    "safe",
    "nutrition",
    "nutrients",
    "for",
    "about",
    "tell me",
    "what about eating",
    "how about eating",
    "what about having",
    "how about having",
    "what about trying",
    "how about trying",
    "what about",
    "how about",
    "can i eat",
    "boleh makan",
    "adakah",
    "makanan",
    "selamat",
    "tentang",
    // Health-assessment adjectives
    "healthy",
    "unhealthy",
    "healthier",
    "unhealthier",
    "good for you",
    "bad for you",
    // Intake-intent wrappers so "i want to eat X" → "X"
    "i would like to eat",
    "i would like to have",
    "i would like to try",
    "i would like",
    "i want to eat",
    "i want to have",
    "i want to try",
    "i feel like eating",
    "i feel like having",
    "i feel like",
    "i am going to eat",
    "i am going to have",
    "i will eat",
    "i will have",
    "i will try",
    "want to eat",
    "want to have",
    "want to try",
    "going to eat",
    "going to have",
    "i want",
    "saya nak makan",
    "saya mahu makan",
    "saya nak",
    "saya mahu",
    "ingin makan",
    "nak makan",
    "mahu makan",
    "可以吃",
    "安全吗",
    "营养",
    "关于",
    "想吃",
    "要吃",
  ];

  for (const wrapper of wrappers) {
    normalized = removeNormalizedPhrase(normalized, wrapper);
  }

  return normalized.trim().replace(/\s+/g, " ");
}

function formatUnavailableFoodName(query: string | undefined, lang: LangCode): string {
  const normalized = normalizeFoodText(query ?? "");
  if (!normalized) return "";
  if (lang === "zh" || hasCjk(normalized)) return normalized.replace(/\s+/g, "");
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function removeNormalizedPhrase(normalizedText: string, phrase: string): string {
  const normalizedPhrase = normalizeFoodText(phrase);
  if (!normalizedPhrase) return normalizedText;

  if (hasCjk(normalizedPhrase)) {
    return normalizedText.split(normalizedPhrase).join(" ");
  }

  return normalizedText.replace(new RegExp(`(^|\\s)${escapeRegExp(normalizedPhrase)}(?=\\s|$)`, "gu"), " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshteinDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) previous[j] = current[j];
  }

  return previous[b.length];
}

function similarityScore(a: string, b: string): number {
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;
  return 1 - levenshteinDistance(a, b) / longer;
}

function hasContiguousTokens(source: string[], candidate: string[]): boolean {
  if (candidate.length === 0 || candidate.length > source.length) return false;
  for (let i = 0; i <= source.length - candidate.length; i++) {
    let matched = true;
    for (let j = 0; j < candidate.length; j++) {
      if (source[i + j] !== candidate[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function hasCjk(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

/** Normalized query → normalized canonical name (must match DB normalizeFoodText output). */
const NORMALIZED_FOOD_QUERY_ALIASES: Record<string, string> = {
  "iced milo": "milo ice",
  "ice milo": "milo ice",
  "milo iced": "milo ice",
};

type FoodNameEntry = {
  food: FoodItem;
  name: string;
  normalizedName: string;
  compactName: string;
  nameTokens: string[];
};

/** True when `nameTokens` begins with every token of `queryTokens` in order (extra trailing tokens = modifiers). */
function tokensPrefix(nameTokens: string[], queryTokens: string[]): boolean {
  if (queryTokens.length > nameTokens.length) return false;
  for (let i = 0; i < queryTokens.length; i++) {
    if (nameTokens[i] !== queryTokens[i]) return false;
  }
  return true;
}

function minTokenCountAcrossNames(food: FoodItem): number {
  return Math.min(
    ...getFoodNames(food).map((n) => normalizeFoodText(n).split(" ").filter(Boolean).length)
  );
}

/** When multiple DB rows tie, prefer the shortest canonical name (fewest tokens). */
function pickShortestCandidateFood(foods: FoodItem[]): FoodItem {
  return foods.reduce((best, cur) =>
    minTokenCountAcrossNames(cur) < minTokenCountAcrossNames(best) ? cur : best
  );
}

function matchFoodQuery(query: string, foods: FoodItem[]): FoodMatchResult {
  const normalizedQuery = normalizeFoodText(query);
  const compactQuery = compactFoodText(query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (!normalizedQuery || !compactQuery || !queryTokens.length) return { status: "none" };

  const entries: FoodNameEntry[] = foods.flatMap((food) =>
    getFoodNames(food).map((name) => {
      const normalizedName = normalizeFoodText(name);
      return {
        food,
        name,
        normalizedName,
        compactName: compactFoodText(name),
        nameTokens: normalizedName.split(" ").filter(Boolean),
      };
    })
  );

  const exactMatches = uniqueFoods(
    entries
      .filter((entry) => entry.normalizedName === normalizedQuery || entry.compactName === compactQuery)
      .map((entry) => entry.food)
  );

  if (exactMatches.length === 1) return { status: "matched", food: exactMatches[0] };
  if (exactMatches.length > 1) return { status: "ambiguous", foods: exactMatches.slice(0, 3) };

  const aliasTarget = NORMALIZED_FOOD_QUERY_ALIASES[normalizedQuery];
  if (aliasTarget) {
    const aliasNorm = normalizeFoodText(aliasTarget);
    const aliasCompact = compactFoodText(aliasTarget);
    const aliasMatches = uniqueFoods(
      entries
        .filter((e) => e.normalizedName === aliasNorm || e.compactName === aliasCompact)
        .map((e) => e.food)
    );
    if (aliasMatches.length === 1) return { status: "matched", food: aliasMatches[0] };
    if (aliasMatches.length > 1) return { status: "ambiguous", foods: aliasMatches.slice(0, 3) };
  }

  const queryHasCjk = hasCjk(normalizedQuery);

  if (queryHasCjk) {
    const prefixHits = entries.filter((e) => e.compactName.startsWith(compactQuery));
    if (prefixHits.length) {
      const minCL = Math.min(...prefixHits.map((e) => e.compactName.length));
      const narrowed = uniqueFoods(
        prefixHits.filter((e) => e.compactName.length === minCL).map((e) => e.food)
      );
      if (narrowed.length === 1) return { status: "matched", food: narrowed[0] };
      if (narrowed.length > 1) return { status: "ambiguous", foods: narrowed.slice(0, 3) };
    }
    const substrHits = entries.filter(
      (e) =>
        e.compactName.includes(compactQuery) &&
        e.compactName !== compactQuery &&
        !e.compactName.startsWith(compactQuery)
    );
    if (substrHits.length) {
      const minCL = Math.min(...substrHits.map((e) => e.compactName.length));
      const narrowed = uniqueFoods(
        substrHits.filter((e) => e.compactName.length === minCL).map((e) => e.food)
      );
      if (narrowed.length === 1) return { status: "matched", food: narrowed[0] };
      if (narrowed.length > 1) return { status: "ambiguous", foods: narrowed.slice(0, 3) };
    }
  } else {
    const latinPrefix = entries.filter((e) => tokensPrefix(e.nameTokens, queryTokens));
    if (latinPrefix.length) {
      const minT = Math.min(...latinPrefix.map((e) => e.nameTokens.length));
      const narrowed = uniqueFoods(
        latinPrefix.filter((e) => e.nameTokens.length === minT).map((e) => e.food)
      );
      if (narrowed.length === 1) return { status: "matched", food: narrowed[0] };
      if (narrowed.length > 1) return { status: "ambiguous", foods: narrowed.slice(0, 3) };
    }

    const latinEmbed = entries.filter(
      (e) =>
        !tokensPrefix(e.nameTokens, queryTokens) &&
        queryTokens.length >= 2 &&
        hasContiguousTokens(e.nameTokens, queryTokens)
    );
    if (latinEmbed.length) {
      const minT = Math.min(...latinEmbed.map((e) => e.nameTokens.length));
      const narrowed = uniqueFoods(
        latinEmbed.filter((e) => e.nameTokens.length === minT).map((e) => e.food)
      );
      if (narrowed.length === 1) return { status: "matched", food: narrowed[0] };
      if (narrowed.length > 1) return { status: "ambiguous", foods: narrowed.slice(0, 3) };
    }
  }

  const fuzzyMatches = entries
    .map((entry) => ({
      food: entry.food,
      nameTokens: entry.nameTokens,
      score: similarityScore(compactQuery, entry.compactName),
    }))
    .sort((a, b) => b.score - a.score);

  const best = fuzzyMatches[0];
  const second = fuzzyMatches.find((match) => match.food.name.en !== best?.food.name.en);

  const extraNameTokens = best ? best.nameTokens.length - queryTokens.length : 0;
  const prefixAligned = best ? tokensPrefix(best.nameTokens, queryTokens) : false;
  const confidentFuzzy =
    best &&
    best.score >= 0.92 &&
    (!second || best.score - second.score >= 0.06) &&
    (prefixAligned ||
      extraNameTokens <= 0 ||
      (best.score >= 0.97 && extraNameTokens <= 1));

  if (confidentFuzzy && best) {
    return { status: "matched", food: best.food };
  }

  const closeMatches = uniqueFoods(
    fuzzyMatches.filter((match) => match.score >= 0.74).map((match) => match.food)
  );

  if (closeMatches.length > 0) {
    return { status: "ambiguous", foods: closeMatches.slice(0, 3) };
  }

  return { status: "none" };
}

function hasAnalysedFoods(scanContext: ChatRequest["scanContext"]): boolean {
  if (!scanContext) return false;
  return (["Main Dish", "Appetizer", "Dessert", "Drinks"] as const).some(
    (category) => Boolean(scanContext[category]?.ranking?.length)
  );
}

function isBestChoiceQuestion(message: string): boolean {
  const normalized = normalizeFoodText(message);
  if (!normalized) return false;
  if (/最好|最佳|推荐|建議|建议|选择|選擇/u.test(message)) return true;
  const phrases = [
    "best choice",
    "best food choice",
    "best food",
    "best in my menu",
    "best choice in my menu",
    "best food choice in my menu",
    "which food should i choose",
    "what should i choose",
    "what do you recommend",
    "recommend",
    "healthiest choice",
    "pilihan terbaik",
    "apa yang patut saya pilih",
    "cadangkan",
    "makanan terbaik",
  ];
  return phrases.some((phrase) => normalized.includes(normalizeFoodText(phrase)));
}

function detectScanCategory(message: string): ScanCategory | null {
  const normalized = normalizeFoodText(message);
  const compact = normalized.replace(/\s+/g, "");
  const categoryAliases: Array<{ category: ScanCategory; aliases: string[] }> = [
    { category: "Main Dish", aliases: ["main dish", "main", "meal", "hidangan utama", "主食", "主菜"] },
    { category: "Appetizer", aliases: ["appetizer", "starter", "side", "pembuka selera", "前菜", "开胃菜"] },
    { category: "Dessert", aliases: ["dessert", "desserts", "pencuci mulut", "甜点", "甜品"] },
    { category: "Drinks", aliases: ["drink", "drinks", "beverage", "minuman", "饮料", "喝"] },
  ];

  for (const { category, aliases } of categoryAliases) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeFoodText(alias);
      if (!normalizedAlias) continue;
      if (hasCjk(normalizedAlias)) {
        if (compact.includes(normalizedAlias.replace(/\s+/g, ""))) return category;
      } else if (normalized === normalizedAlias || normalized.includes(normalizedAlias)) {
        return category;
      }
    }
  }
  return null;
}

function isCategorySelectionMessage(message: string, category: ScanCategory | null): boolean {
  if (!category) return false;
  const normalized = normalizeFoodText(message);
  const compact = normalized.replace(/\s+/g, "");
  const allowed: Record<ScanCategory, string[]> = {
    "Main Dish": ["main dish", "main", "hidangan utama", "主食", "主菜"],
    Appetizer: ["appetizer", "starter", "pembuka selera", "前菜", "开胃菜"],
    Dessert: ["dessert", "desserts", "pencuci mulut", "甜点", "甜品"],
    Drinks: ["drink", "drinks", "minuman", "饮料"],
  };
  return allowed[category].some((alias) => {
    const normalizedAlias = normalizeFoodText(alias);
    return hasCjk(normalizedAlias)
      ? compact === normalizedAlias.replace(/\s+/g, "")
      : normalized === normalizedAlias;
  });
}

function findBestChoiceCategory(message: string): ScanCategory | null {
  const normalized = normalizeFoodText(message);
  const compact = normalized.replace(/\s+/g, "");
  if (!normalized) return null;

  const categoryAliases: Array<{ category: ScanCategory; aliases: string[] }> = [
    { category: "Main Dish", aliases: ["main dish", "main", "meal", "hidangan utama", "主食", "主菜"] },
    { category: "Appetizer", aliases: ["appetizer", "starter", "side", "pembuka selera", "前菜", "开胃菜"] },
    { category: "Dessert", aliases: ["dessert", "desserts", "pencuci mulut", "甜点", "甜品"] },
    { category: "Drinks", aliases: ["drink", "drinks", "beverage", "minuman", "饮料"] },
  ];

  for (const { category, aliases } of categoryAliases) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeFoodText(alias);
      if (hasCjk(normalizedAlias)) {
        if (compact.includes(normalizedAlias.replace(/\s+/g, ""))) return category;
      } else if (normalized.includes(normalizedAlias)) {
        return category;
      }
    }
  }
  return null;
}

function getLocalizedScanCategory(category: ScanCategory, lang: LangCode): string {
  const labels: Record<ScanCategory, Record<LangCode, string>> = {
    "Main Dish": { en: "Main Dish", ms: "Hidangan Utama", zh: "主食" },
    Appetizer: { en: "Appetizer", ms: "Pembuka Selera", zh: "前菜" },
    Dessert: { en: "Dessert", ms: "Pencuci Mulut", zh: "甜点" },
    Drinks: { en: "Drink", ms: "Minuman", zh: "饮料" },
  };
  return labels[category][lang];
}

function getScanCategoryButtons(lang: LangCode): string[] {
  return (["Main Dish", "Appetizer", "Dessert", "Drinks"] as const).map((category) =>
    getLocalizedScanCategory(category, lang)
  );
}

function noAnalysedFoodReply(lang: LangCode): string {
  return {
    en: "No food has been analysed yet.",
    ms: "Belum ada makanan yang dianalisis.",
    zh: "目前还没有分析食物。",
  }[lang];
}

function askCategoryReply(lang: LangCode): ChatResponse {
  const text = {
    en: "Which category would you like me to check?",
    ms: "Kategori mana yang anda mahu saya semak?",
    zh: "您想查看哪个类别？",
  }[lang];
  return { reply: text, quickReplies: getScanCategoryButtons(lang) };
}

function selectLocalizedText(value: ScanFoodItem["tip"] | ScanFoodItem["best_reason"], lang: LangCode): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || "";
}

function exactDatasetFoodMatch(foodName: string, foods: FoodItem[]): FoodItem | null {
  const rawName = foodName.trim().toLowerCase();
  if (!rawName) return null;

  const rawMatches = uniqueFoods(foods.filter((food) =>
    getFoodNames(food).some((name) => name.trim().toLowerCase() === rawName)
  ));
  if (rawMatches.length === 1) return rawMatches[0];
  if (rawMatches.length > 1) return null;

  const normalizedName = normalizeFoodText(foodName);
  const normalizedMatches = uniqueFoods(foods.filter((food) =>
    getFoodNames(food).some((name) => normalizeFoodText(name) === normalizedName)
  ));
  return normalizedMatches.length === 1 ? normalizedMatches[0] : null;
}

function parseNutrientNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function nutritionWarningLine(kind: "sugar" | "sodium" | "fat" | "gi", value: number | null, lang: LangCode): string {
  if (value === null) return "";
  const isHigh =
    (kind === "sugar" && value > 15) ||
    (kind === "sodium" && value > 600) ||
    (kind === "fat" && value > 7) ||
    (kind === "gi" && value >= 70);
  if (!isHigh) return "";

  const labels: Record<LangCode, Record<"sugar" | "sodium" | "fat" | "gi", string>> = {
    en: { sugar: "High Sugar", sodium: "High Salt/Sodium", fat: "High Fat", gi: "High GI" },
    ms: { sugar: "Gula Tinggi", sodium: "Garam/Natrium Tinggi", fat: "Lemak Tinggi", gi: "IG Tinggi" },
    zh: { sugar: "糖分高", sodium: "盐/钠高", fat: "脂肪高", gi: "GI 高" },
  };

  return `!HIGH_NUTRITION! ${labels[lang][kind]}`;
}

function formatMaybeValue(value: string | number | undefined, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function compactBlankLines(value: string): string {
  return value
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
}

function riskScore(risk: unknown): number {
  const normalized = normaliseRisk(risk);
  if (normalized === "Low") return 1;
  if (normalized === "High") return 3;
  return 2;
}

function getBestScanFood(
  scanContext: NonNullable<ChatRequest["scanContext"]>,
  category: ScanCategory | null
): ScanFoodItem | null {
  if (category) return scanContext[category]?.ranking?.[0] ?? null;

  const allItems = (["Main Dish", "Appetizer", "Dessert", "Drinks"] as const)
    .flatMap((scanCategory) => scanContext[scanCategory]?.ranking ?? []);

  return allItems.sort((a, b) => {
    const riskDiff = riskScore(a.risk) - riskScore(b.risk);
    if (riskDiff !== 0) return riskDiff;
    if (a.salt !== b.salt) return a.salt - b.salt;
    if (a.sugar !== b.sugar) return a.sugar - b.sugar;
    return a.fat - b.fat;
  })[0] ?? null;
}

function buildBestChoiceResponse(
  category: ScanCategory | null,
  scanContext: NonNullable<ChatRequest["scanContext"]>,
  foods: FoodItem[],
  lang: LangCode
): ChatResponse {
  const best = getBestScanFood(scanContext, category);
  if (!best) {
    return {
      reply: {
        en: category ? `No analysed food found for ${getLocalizedScanCategory(category, lang)} yet.` : "No food has been analysed yet.",
        ms: category ? `Belum ada makanan dianalisis untuk ${getLocalizedScanCategory(category, lang)}.` : "Belum ada makanan yang dianalisis.",
        zh: category ? `目前没有${getLocalizedScanCategory(category, lang)}的分析结果。` : "目前还没有分析食物。",
      }[lang],
    };
  }

  const datasetFood = exactDatasetFoodMatch(best.f, foods);
  const foodName = datasetFood?.name[lang] || datasetFood?.name.en || best.f;
  const unavailable = { en: "Not available", ms: "Tiada data", zh: "暂无数据" }[lang];
  const reason = selectLocalizedText(best.best_reason, lang);
  const tip = datasetFood ? (datasetFood.tip[lang] || datasetFood.tip.en) : selectLocalizedText(best.tip, lang);

  const labels = {
    en: {
      best: "Best Choice",
      riskSummary: (name: string, risk: string) => `${name} is the better choice from the foods found. It is a ${risk} option for the Three Highs.`,
      lowerSugar: "✅ Lower sugar than many sweet foods",
      highSodiumFat: "⚠️ Higher in fat and sodium",
      highSodium: "⚠️ Higher in sodium",
      highFat: "⚠️ Higher in fat",
      why: "Why",
      tip: "Health Tip",
      openFull: "Open Full Analysis",
    },
    ms: {
      best: "Pilihan Terbaik",
      riskSummary: (name: string, risk: string) => `${name} ialah pilihan yang lebih baik daripada makanan yang dijumpai. Ia pilihan ${risk} untuk Tiga Tinggi.`,
      lowerSugar: "✅ Gula lebih rendah berbanding banyak makanan manis",
      highSodiumFat: "⚠️ Lebih tinggi lemak dan natrium",
      highSodium: "⚠️ Lebih tinggi natrium",
      highFat: "⚠️ Lebih tinggi lemak",
      why: "Sebab",
      tip: "Tip Kesihatan",
      openFull: "Buka Analisis Penuh",
    },
    zh: {
      best: "最佳选择",
      riskSummary: (name: string, risk: string) => `${name} 是检测到的食物中较好的选择。它在三高方面属于${risk}选择。`,
      lowerSugar: "✅ 糖分比许多甜食低",
      highSodiumFat: "⚠️ 脂肪和钠较高",
      highSodium: "⚠️ 钠较高",
      highFat: "⚠️ 脂肪较高",
      why: "原因",
      tip: "健康提示",
      openFull: "打开完整分析",
    },
  }[lang];

  const notes: string[] = [];
  if (best.sugar <= 5) notes.push(labels.lowerSugar);
  if (best.salt > 600 && best.fat > 7) {
    notes.push(labels.highSodiumFat);
  } else {
    if (best.salt > 600) notes.push(labels.highSodium);
    if (best.fat > 7) notes.push(labels.highFat);
  }

  return {
    reply: compactBlankLines(`${labels.best}:
${foodName}

${labels.riskSummary(foodName, getLocalizedRiskLabel(normaliseRisk(best.risk).toLowerCase() as "low" | "medium" | "high", lang))}

${notes.slice(0, 2).join("\n")}

${reason ? `${labels.why}:\n${reason}\n\n` : ""}${labels.tip}:
${tip || unavailable}`),
    suggestions: datasetFood ? [datasetFood] : undefined,
    actionButton: { label: labels.openFull, href: "/recommendation" },
  };
}

function normaliseRisk(raw: unknown): "Low" | "Medium" | "High" {
  const s = String(raw ?? "").toLowerCase().trim().replace(/\s+risk$/, "");
  if (s === "low") return "Low";
  if (s === "high") return "High";
  return "Medium";
}

// ─── SYSTEM PROMPT BUILDER ────────────────────────────────────────────────────

function buildSystemPrompt(
  language: LangCode,
  scanContext: ChatRequest["scanContext"]
): string {
  const langInstructions: Record<LangCode, string> = {
    en: "Respond entirely in English.",
    ms: "Jawab sepenuhnya dalam Bahasa Malaysia.",
    zh: "请完全使用简体中文回答。",
  };

  const langInstruction = langInstructions[language];

  // Build food context from sessionStorage scan results
  let foodContext = "";
  if (scanContext) {
    const allItems: string[] = [];
    const categories = ["Appetizer", "Main Dish", "Dessert", "Drinks"] as const;

    for (const cat of categories) {
      const catData = scanContext[cat];
      if (catData?.ranking?.length) {
        for (const item of catData.ranking) {
          const caloriesText = typeof item.calories === "number" ? `, Calories: ${item.calories}kcal` : "";
          const giText = typeof item.gi === "number" ? `, GI: ${item.gi}` : "";
          allItems.push(
            `- ${item.f} (Risk: ${item.risk}, Sugar: ${item.sugar}g, Sodium: ${item.salt}mg, Fat: ${item.fat}g${caloriesText}${giText})`
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

  return `You are Siti, a friendly SIHAT health assistant specialising in diabetes, hypertension, and hyperlipidaemia (the "Three Highs") for elderly Malaysian users.

${langInstruction}

YOUR ROLE:
- Only discuss foods the user names in their CURRENT message. Do not repeat food analysis from earlier turns unless they name that food again.
- Answer questions about diabetes, high blood pressure, and high cholesterol in simple, easy-to-understand language.
- Provide dietary guidance based on sugar, salt, and fat (the Three Highs framework).
- Help users understand their food choices and make healthier decisions.
- Keep the chatbot as a quick guidance layer, not a detailed nutrition report.
- Do NOT list detailed nutrition values such as Sugar, Calories, GI, Fat, or Sodium in normal chatbot replies.
- When answering about specific foods, mention only the food name, simple risk level, one short reason, and one short health tip.
- If the user needs detailed nutrition values, guide them to the Full Analysis page.
- For foods not in our database, do not invent detailed numbers. Give a cautious general tip such as "Watch portion size" or "Choose lower sodium options".
- Keep responses SHORT: maximum 4 sentences. Be warm and encouraging.

${foodContext}

STRICT RULES (NEVER break these):
1. Do NOT provide medical diagnoses, treatment plans, or medication recommendations.
2. Do NOT suggest specific drug dosages or medical procedures.
3. STRICTLY limit responses to 2-3 sentences maximum. Under 50 words only.
4. Do NOT include any disclaimer in your response. The disclaimer is shown separately in the UI.
5. If the user asks about topics UNRELATED to diabetes, high blood pressure, high cholesterol, food nutrition, or the SIHAT website features, politely redirect them in one short, respectful sentence.
6. NEVER answer questions about: politics, entertainment, technology, recipes unrelated to health, financial advice, or any topic outside health and nutrition.

TONE & PERSONALITY:
- Friendly, warm, clear, respectful, and suitable for elderly healthcare users.
- Sound professional but approachable.
- Avoid slang and repeated casual fillers such as "lah", "ah", "alamak", and "jangan risau".
- Use simple words and avoid technical wording when possible.
- Always warm, encouraging, never scary.
`;
}

// ─── GROQ LLAMA (CHATBOT ONLY) ────────────────────────────────────────────────

const GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

function getGroqChatKeys(): string[] {
  const keys = [
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
  ].filter((k): k is string => Boolean(k?.trim()));
  return [...new Set(keys)];
}

function hasGroqChatKey(): boolean {
  return getGroqChatKeys().length > 0;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function parseGroqChatText(data: unknown): string {
  const payload = data as { choices?: Array<{ message?: { content?: string } }> };
  return payload?.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callGroqChat(
  systemPrompt: string,
  messages: ChatMessage[],
  apiKey: string,
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  if (!apiKey) throw new Error("Groq API key is undefined or empty");

  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: options.temperature ?? 0.4,
      max_tokens: options.max_tokens ?? 150,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = parseGroqChatText(data);
  if (!text) throw new Error("Empty response from Groq");
  return text;
}

async function generateGroqChatReply(
  systemPrompt: string,
  messages: ChatMessage[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const keys = getGroqChatKeys();
  if (!keys.length) {
    throw new Error("No Groq API keys configured (GROQ_API_KEY_3/4 or GROQ_API_KEY/GROQ_API_KEY_2)");
  }

  for (const key of keys) {
    try {
      return await callGroqChat(systemPrompt, messages, key, options);
    } catch (err) {
      console.warn(`[chat] Groq/Llama failed: ${errorMessage(err)}`);
    }
  }

  throw new Error("Groq/Llama failed for all keys");
}

// ─── AI FOOD CARD ESTIMATION ──────────────────────────────────────────────────

async function getEstimatedFoodCards(names: string[], lang: LangCode): Promise<EstimatedFoodCard[]> {
  if (!names.length) return [];

  const langName = lang === "zh" ? "Simplified Chinese" : lang === "ms" ? "Bahasa Malaysia" : "English";
  const isSingle = names.length === 1;

  const prompt = isSingle
    ? `The user input may be a sentence. Your first job is to extract ONLY the actual food or drink name.
If there is no real food or drink in the input, set foodName to null and do not analyse.
Input: "${names[0]}"
Reply ONLY with this JSON (no other text):
{"foodName":"Extracted food/drink name, or null if not a real food","category":"Main Dish","risk":"medium","sugar":0,"sodium":0,"fat":0,"tip":"One sentence health tip."}
Rules:
- foodName: the clean dish/drink name only (e.g. "Pizza", "Nasi Lemak", "Teh Tarik"). Set to null if input has no real food.
- category: "Main Dish"|"Appetizer"|"Dessert"|"Drink"
- risk: "low"|"medium"|"high"
- sugar: estimated sugar in grams per typical serving (number)
- sodium: estimated sodium in milligrams per typical serving (number)
- fat: estimated fat in grams per typical serving (number)
- tip: one short sentence in ${langName}
Examples:
Input "i want to eat pizza" → foodName:"Pizza"
Input "is nasi lemak healthy?" → foodName:"Nasi Lemak"
Input "dont talk to me" → foodName:null
Input "who am i" → foodName:null
Input "pmg" → foodName:null`
    : `The user inputs below may be sentences. For each, extract ONLY the food or drink name. If none exists, set foodName to null.
${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}
Reply ONLY with a JSON array (no other text):
[{"foodName":"Extracted food/drink name or null","category":"Main Dish","risk":"medium","sugar":0,"sodium":0,"fat":0,"tip":"Tip."},...]
Rules:
- foodName: clean dish/drink name only, or null if no real food in that input
- category: "Main Dish"|"Appetizer"|"Dessert"|"Drink"
- risk: "low"|"medium"|"high"
- sugar, sodium, fat: numeric estimates per typical serving (sugar and fat in g, sodium in mg)
- tip: short ${langName} sentence`;

  const validCat = (v: unknown): EstimatedFoodCategory | null =>
    (["Main Dish", "Appetizer", "Dessert", "Drink"] as EstimatedFoodCategory[]).find(c => c === v) ?? null;
  const validRisk = (v: unknown): "low" | "medium" | "high" =>
    (["low", "medium", "high"] as const).find(r => r === v) ?? "medium";
  const num = (v: unknown): number | undefined => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    return Number.isFinite(n) ? n : undefined;
  };

  /** Extract a clean food name from the AI's foodName field, or null if it is absent/null/"null"/empty. */
  const parseFoodName = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s || s.toLowerCase() === "null") return null;
    return s;
  };

  try {
    const text = await generateGroqChatReply(
      "You are a health assistant. Reply only with valid JSON.",
      [{ role: "user", content: prompt }],
      { temperature: 0.1, max_tokens: isSingle ? 120 : 280 }
    );

    if (isSingle) {
      const m = text.match(/\{[\s\S]*?\}/);
      if (!m) return [];
      const p = JSON.parse(m[0]);
      const foodName = parseFoodName(p.foodName);
      if (!foodName) {
        console.log(`[chat] getEstimatedFoodCards: AI returned null foodName for input "${names[0]}" — skipping card`);
        return [];
      }
      const sugar = num(p.sugar);
      const sodium = num(p.sodium);
      const fat = num(p.fat);
      const modelRisk = validRisk(p.risk);
      const risk =
        sugar !== undefined && sodium !== undefined && fat !== undefined
          ? computeRiskFromIndicators(sugar, sodium, fat, modelRisk)
          : modelRisk;
      return [
        {
          name: foodName,
          category: validCat(p.category),
          risk,
          tip: String(p.tip ?? "").trim(),
          sugar,
          sodium,
          fat,
        },
      ];
    } else {
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) return [];
      const arr = JSON.parse(m[0]);
      if (!Array.isArray(arr)) return [];
      const cards: EstimatedFoodCard[] = [];
      names.forEach((n, i) => {
        const p: Record<string, unknown> = arr[i] ?? {};
        const foodName = parseFoodName(p.foodName);
        if (!foodName) {
          console.log(`[chat] getEstimatedFoodCards: null foodName for item "${n}" — skipping`);
          return;
        }
        const sugar = num(p.sugar);
        const sodium = num(p.sodium);
        const fat = num(p.fat);
        const modelRisk = validRisk(p.risk);
        const risk =
          sugar !== undefined && sodium !== undefined && fat !== undefined
            ? computeRiskFromIndicators(sugar, sodium, fat, modelRisk)
            : modelRisk;
        cards.push({
          name: foodName,
          category: validCat(p.category),
          risk,
          tip: String(p.tip ?? "").trim(),
          sugar,
          sodium,
          fat,
        });
      });
      return cards;
    }
  } catch {
    return [];
  }
}

/**
 * STEP 2–3 — Match SIHAT database first; AI estimate only for plausible non-DB foods.
 */
async function processExtractedFoodNames(
  message: string,
  foodNames: string[],
  foods: FoodItem[],
  requestLang: LangCode,
  openFullLabels: Record<LangCode, string>
): Promise<Response | null> {
  if (!foodNames.length) return null;

  console.log(`[chat] extracted food names: ${JSON.stringify(foodNames)}`);

  const matchedFoods: FoodItem[] = [];
  const unmatchedForAi: string[] = [];
  const declinedRealFood: string[] = [];
  const ambiguousGroups: FoodItem[][] = [];

  for (const part of foodNames) {
    const m = matchFoodQuery(part, foods);
    if (m.status === "matched") {
      matchedFoods.push(m.food);
      console.log(`[chat] database match found: "${part}" → "${m.food.name.en}"`);
    } else if (m.status === "ambiguous" && m.foods.length > 0) {
      console.log(`[chat] database match ambiguous: "${part}" (${m.foods.length} candidates)`);
      if (foodNames.length === 1) {
        ambiguousGroups.push(m.foods);
      } else {
        matchedFoods.push(pickShortestCandidateFood(m.foods));
      }
    } else if (looksLikePlausibleFoodName(part) && isLikelyRealFoodName(part, message)) {
      console.log(`[chat] database match not found: "${part}" (AI estimate)`);
      unmatchedForAi.push(part);
    } else if (looksLikePlausibleFoodName(part)) {
      declinedRealFood.push(part);
      console.log(`[chat] rejected AI food card (not a credible food name): "${part}"`);
    } else {
      console.log(`[chat] skipped non-food fragment: "${part}"`);
    }
  }

  if (foodNames.length === 1 && ambiguousGroups.length === 1) {
    console.log("[chat] Llama called: no (ambiguous database suggestions)");
    return NextResponse.json(
      formatFoodSuggestions(ambiguousGroups[0]!, requestLang, foodNames[0], openFullLabels)
    );
  }

  if (
    matchedFoods.length === 0 &&
    ambiguousGroups.length === 0 &&
    unmatchedForAi.length === 0 &&
    declinedRealFood.length > 0
  ) {
    console.log("[chat] clarification: term(s) do not look like real food/drink names");
    return NextResponse.json({ reply: couldYouSpecifyFoodNameReply(requestLang) });
  }

  // ── AI fallback for unmatched candidates ─────────────────────────────────────
  const rawAiCards =
    unmatchedForAi.length > 0 && hasGroqChatKey()
      ? await getEstimatedFoodCards(unmatchedForAi, requestLang)
      : [];

  // ── Post-AI DB re-validation ──────────────────────────────────────────────────
  // The AI normalises food names (e.g. "tell me teh tarik" → "Teh Tarik").
  // Re-check each AI card name against the database.  Any hit is promoted to a
  // proper database card so the response never carries an AI disclaimer for a food
  // that is already in SIHAT.
  const estimatedFoods: EstimatedFoodCard[] = [];
  for (const card of rawAiCards) {
    const recheck = card.name ? matchFoodQuery(card.name, foods) : { status: "none" as const };
    const source = recheck.status === "matched" || recheck.status === "ambiguous" ? "database" : "ai";
    const confidence =
      recheck.status === "matched" ? "db-exact-post-ai" :
      recheck.status === "ambiguous" ? "db-ambiguous-post-ai" : "ai";

    console.log(JSON.stringify({
      event: "food-source-decision",
      foodName: card.name,
      source,
      isAIGenerated: source === "ai",
      confidence,
      recheckStatus: recheck.status,
    }));

    if (recheck.status === "matched") {
      matchedFoods.push(recheck.food);
    } else if (recheck.status === "ambiguous") {
      matchedFoods.push(pickShortestCandidateFood(recheck.foods));
    } else {
      estimatedFoods.push(card);
    }
  }

  // Compute unique DB matches AFTER all possible upgrades from AI re-check.
  const uniqueMatched = uniqueFoods(matchedFoods);

  // Log each initial DB match decision too.
  for (const food of uniqueMatched) {
    console.log(JSON.stringify({
      event: "food-source-decision",
      foodName: food.name.en,
      source: "database",
      isAIGenerated: false,
      confidence: "db-matched",
    }));
  }

  if (uniqueMatched.length === 0 && estimatedFoods.length === 0) {
    console.log("[chat] Llama called: no (no database or AI food result)");
    return null;
  }

  if (foodNames.length === 1 && uniqueMatched.length === 1 && estimatedFoods.length === 0) {
    console.log("[chat] Llama called: no (structured database food card)");
    return NextResponse.json(
      buildStructuredDatabaseFoodResponse(uniqueMatched[0]!, requestLang, openFullLabels)
    );
  }

  if (foodNames.length === 1 && uniqueMatched.length === 0 && estimatedFoods.length === 1) {
    console.log("[chat] Llama called: yes (AI food estimate only — not in DB)");
    return NextResponse.json({
      reply: buildMultiFoodIntro(1, requestLang),
      estimatedFood: estimatedFoods[0],
      actionButton: { label: openFullLabels[requestLang], href: "/recommendation" },
      isMultiFood: false,
    });
  }

  if (estimatedFoods.length > 0) {
    console.log(`[chat] Llama called: yes (AI estimate for: ${JSON.stringify(unmatchedForAi)})`);
  } else {
    console.log("[chat] Llama called: no (structured database food cards only)");
  }

  const totalCount = uniqueMatched.length + estimatedFoods.length;
  return NextResponse.json({
    reply: buildMultiFoodIntro(totalCount, requestLang),
    suggestions: uniqueMatched.length > 0 ? uniqueMatched : undefined,
    estimatedFoods: estimatedFoods.length > 0 ? estimatedFoods : undefined,
    actionButton:
      totalCount > 0 ? { label: openFullLabels[requestLang], href: "/recommendation" } : undefined,
    isMultiFood: totalCount > 1,
  });
}

/** Normal chat path — no food extraction, cards, or View Detailed Analysis. */
async function respondNormalChat(
  message: string,
  history: ChatMessage[],
  requestLang: LangCode
): Promise<Response> {
  if (isCasualAcknowledgement(message)) {
    console.log("[chat] casual acknowledgement (no food card)");
    return NextResponse.json({ reply: casualAcknowledgementReply(requestLang, message) });
  }

  if (isComplaintOrClarification(message)) {
    console.log("[chat] complaint / clarification (no food card)");
    return NextResponse.json({ reply: complaintClarificationReply(requestLang) });
  }

  if (isConversationalOnlyMessage(message)) {
    console.log("[chat] conversational chit-chat — Llama one-liner, no food prompt");
    const reply = await generateGroqChatReply(
      buildBriefChitChatSystemPrompt(requestLang),
      [...history.slice(-6), { role: "user", content: message }],
      { max_tokens: 80, temperature: 0.35 }
    );
    return NextResponse.json({ reply });
  }

  console.log("[chat] Llama called: yes (normal chat, current message only)");
  const systemPrompt = buildSystemPrompt(requestLang, null);
  const reply = await generateGroqChatReply(systemPrompt, [
    ...history.slice(-6),
    { role: "user", content: message },
  ]);
  return NextResponse.json({ reply });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let requestLang: LangCode = "en";

  try {
    const body: ChatRequest = await req.json();
    const { message, history = [], language = "en", scanContext = null, cart = [], intakeSummary } = body;
    const selectedLang = toLangCode(language);
    requestLang = selectedLang;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    requestLang = detectUserMessageLanguage(message) ?? selectedLang;

    // Fetch food data for lookup
    const rows = await getAllFoodData();
    const foods = transformFoodRows(rows);

    // Check for cart command
    const command = parseCartCommand(message, foods, requestLang);
    if (command) {
      if (command.action === "view") {
        const summary = intakeSummary ?? buildDailyIntakeSummary(cart, "male", requestLang);
        return NextResponse.json({ reply: formatDailyIntakeSummary(summary, requestLang) });
      }
      const result = updateCart(cart, command, requestLang);
      return NextResponse.json(result);
    }

    if (isDailyIntakeQuestion(message, requestLang)) {
      const summary = intakeSummary ?? buildDailyIntakeSummary(cart, "male", requestLang);
      return NextResponse.json({ reply: formatDailyIntakeSummary(summary, requestLang) });
    }

    const bestChoiceQuestion = isBestChoiceQuestion(message);
    const selectedCategory = detectScanCategory(message);
    const scanCategory = bestChoiceQuestion ? findBestChoiceCategory(message) : selectedCategory;
    const categorySelection = isCategorySelectionMessage(message, selectedCategory);
    if (bestChoiceQuestion || categorySelection) {
      if (!hasAnalysedFoods(scanContext)) {
        return NextResponse.json({ reply: noAnalysedFoodReply(requestLang) });
      }
      const analysedScanContext = scanContext!;

      if (!scanCategory && categorySelection) {
        return NextResponse.json(askCategoryReply(requestLang));
      }

      return NextResponse.json(buildBestChoiceResponse(scanCategory, analysedScanContext, foods, requestLang));
    }

    if (!hasGroqChatKey()) {
      throw new Error("No Groq API keys configured (GROQ_API_KEY_3/4 or GROQ_API_KEY/GROQ_API_KEY_2)");
    }

    const openFullLabels: Record<LangCode, string> = {
      en: "Open Full Analysis",
      ms: "Buka Analisis Penuh",
      zh: "打开完整分析",
    };

    let intent = classifyChatIntent(message);

    // ── Database-first override ───────────────────────────────────────────────
    // If the lexeme-based classifier returned normal_chat, attempt a quick DB
    // lookup before giving up.  This ensures foods that exist in the SIHAT
    // database (e.g. "otak-otak", "rendang", local dishes) produce a structured
    // card even when they are absent from REAL_FOOD_LEXEME_RE.
    //
    // Guard: skip for messages that are explicitly conversational — we must not
    // accidentally promote "dont talk to me" or "pmg" to food_analysis_request.
    let dbPreCheckCandidate: string | null = null;
    if (intent === "normal_chat" && !isDefinitelyNonFoodMessage(message)) {
      const candidate = extractFoodQueryCandidate(message);
      if (candidate) {
        const dbPreCheck = matchFoodQuery(candidate, foods);
        if (dbPreCheck.status === "matched" || dbPreCheck.status === "ambiguous") {
          console.log(`[chat] DB pre-check: "${candidate}" → overriding to food_analysis_request`);
          intent = "food_analysis_request";
          dbPreCheckCandidate = candidate;
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    console.log(`[chat] intent: ${intent}`);

    if (intent === "follow_up_question") {
      if (hasAnalysedFoods(scanContext)) {
        console.log("[chat] follow-up question — using scan context, Llama brief explanation");
        const systemPrompt = buildFollowUpSystemPrompt(requestLang, scanContext!);
        const reply = await generateGroqChatReply(systemPrompt, [
          ...history.slice(-4),
          { role: "user", content: message },
        ]);
        return NextResponse.json({ reply });
      }
      console.log("[chat] follow-up question — no scan context");
      return NextResponse.json({ reply: followUpWithoutContextReply(requestLang) });
    }

    if (intent !== "food_analysis_request") {
      return respondNormalChat(message, history, requestLang);
    }

    // food_analysis_request only: extract → DB match → AI estimate (strict gates inside).
    // If the DB pre-check already extracted the candidate, use it directly so we
    // don't re-run intent classification inside extractFoodNamesFromMessage (which
    // would see normal_chat and return []).
    const extractedFoodNames = dbPreCheckCandidate
      ? [dbPreCheckCandidate]
      : extractFoodNamesFromMessage(message);
    if (extractedFoodNames.length > 0) {
      const foodResult = await processExtractedFoodNames(
        message,
        extractedFoodNames,
        foods,
        requestLang,
        openFullLabels
      );
      if (foodResult) return foodResult;
    }

    if (isVagueFoodAnalysisIntent(message)) {
      return NextResponse.json({ reply: whichFoodClarificationReply(requestLang) });
    }

    console.log("[chat] food_analysis_request but no valid dish extracted — ask for food name");
    return NextResponse.json({ reply: couldYouSpecifyFoodNameReply(requestLang) });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[chat] ❌ Error:", errMsg);

    // Fallback messages per language — return 200 so UI doesn't crash
    const fallbacks: Record<string, string> = {
      en: "Sorry, I'm unable to respond right now. Please try again in a moment.",
      ms: "Maaf, saya tidak dapat menjawab sekarang. Sila cuba lagi sebentar.",
      zh: "抱歉，我暂时无法回答。请稍后再试。",
    };

    const lang = typeof requestLang === "string" ? requestLang : "en";

    return NextResponse.json(
      { reply: fallbacks[lang] ?? fallbacks["en"] },
      { status: 200 }
    );
  }
}
