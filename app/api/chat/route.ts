// app/api/chat/route.ts
// Epic 9: AI Conversational Health Assistant
// Uses Google Gemini API with Gemma 4 E4B (gemma-4-e4b-it)
// Supports context-aware advice from food scan sessionStorage data
// Supports multi-language: English, Bahasa Malaysia, Simplified Chinese

import { NextRequest, NextResponse } from "next/server";
import { getAllFoodData, type FoodDataRow } from "@/lib/queries";
import { buildDailyIntakeSummary, type DailyIntakeSummary } from "@/lib/daily-intake-summary";
import { type FoodItem, getSugarLevel, getGILevel, getFatLevel, getSodiumLevel } from "@/lib/food-functions";

export const maxDuration = 30;

interface ChatResponse {
  reply: string;
  action?: {
    type: "add" | "remove" | "clear";
    food?: FoodItem;
  };
  suggestions?: FoodItem[];
  unavailableFoodName?: string;
}

interface ScanFoodItem {
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
    "Appetizer"?: { ranking: ScanFoodItem[] };
    "Main Dish"?: { ranking: ScanFoodItem[] };
    "Dessert"?: { ranking: ScanFoodItem[] };
    "Drinks"?: { ranking: ScanFoodItem[] };
    uniqueFoodCount?: number;
  } | null;
  cart?: FoodItem[];
  intakeSummary?: DailyIntakeSummary;
}

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

// ─── NUTRITION RESPONSE BUILDERS ──────────────────────────────────────────────

function buildNutritionSection(food: FoodItem, lang: "en" | "ms" | "zh"): string {
  const labels = {
    en: {
      title: "Nutrition for",
      sugar: "Sugar",
      calories: "Calories",
      gi: "GI",
      fat: "Fat",
      sodium: "Sodium",
      thingsToNote: "Things to note",
      tip: "Three Highs Health Tip",
      highSodiumFat: "⚠️ High in sodium and fat",
      highSodium: "⚠️ High in sodium",
      highFat: "⚠️ High in fat",
      giWarning: "⚠️ May raise blood sugar quickly",
    },
    ms: {
      title: "Nutrisi untuk",
      sugar: "Gula",
      calories: "Kalori",
      gi: "IG",
      fat: "Lemak",
      sodium: "Natrium",
      thingsToNote: "Perkara yang perlu diperhatikan",
      tip: "Petua Kesihatan Tiga Tinggi",
      highSodiumFat: "⚠️ Tinggi natrium dan lemak",
      highSodium: "⚠️ Tinggi natrium",
      highFat: "⚠️ Tinggi lemak",
      giWarning: "⚠️ Boleh naikkan gula darah dengan cepat",
    },
    zh: {
      title: "营养信息",
      sugar: "糖",
      calories: "卡路里",
      gi: "GI",
      fat: "脂肪",
      sodium: "钠",
      thingsToNote: "注意事项",
      tip: "三高健康提示",
      highSodiumFat: "⚠️ 高钠和高脂肪",
      highSodium: "⚠️ 高钠",
      highFat: "⚠️ 高脂肪",
      giWarning: "⚠️ 可能快速升高血糖",
    },
  };

  const l = labels[lang];
  const foodName = food.name[lang] || food.name.en;
  const tip = food.tip[lang] || food.tip.en || "";

  // Get levels using existing helpers
  const sugarLevel = getSugarLevel(food.sugar);
  const giLevel = getGILevel(food.gi);
  const fatLevel = getFatLevel(food.fat);
  const sodiumLevel = getSodiumLevel(food.sodium);

  // Build warnings summary
  const warnings: string[] = [];
  if (giLevel === "high") {
    warnings.push(l.giWarning);
  }
  if (sodiumLevel === "high" && fatLevel === "high") {
    warnings.push(l.highSodiumFat);
  } else {
    if (sodiumLevel === "high") warnings.push(l.highSodium);
    if (fatLevel === "high") warnings.push(l.highFat);
  }

  const thingsToNote = warnings.length > 0 ? `\n${l.thingsToNote}:\n${warnings.join('\n')}` : '';

  return `${l.title} ${foodName}

${l.sugar}: ${food.sugar}
${l.calories}: ${food.calories}
${l.gi}: ${food.gi}
${l.fat}: ${food.fat}
${l.sodium}: ${food.sodium}${thingsToNote}

${l.tip}:
${tip}`;
}

// ─── CART MANAGEMENT ──────────────────────────────────────────────────────────

type FoodMatchResult =
  | { status: "matched"; food: FoodItem }
  | { status: "ambiguous"; foods: FoodItem[] }
  | { status: "none" }

function parseCartCommand(message: string, foods: FoodItem[], lang: "en" | "ms" | "zh"): { action: string; food?: FoodItem; suggestions?: FoodItem[]; query?: string } | null {
  const lowerMsg = message.toLowerCase();
  const labels = {
    en: { add: ["add", "put", "include", "insert"], remove: ["remove", "delete"], clear: ["clear", "empty"], view: ["what is in my food plan", "show my plan", "my food plan"] },
    ms: { add: ["tambah", "masukkan"], remove: ["buang", "padam"], clear: ["kosongkan", "clear"], view: ["apa dalam pelan makanan saya", "tunjuk pelan saya"] },
    zh: { add: ["添加", "加入", "放"], remove: ["删除", "移除"], clear: ["清空"], view: ["我的食物计划有什么"] },
  };

  const l = labels[lang];

  // Check for clear
  if (l.clear.some(word => lowerMsg.includes(word))) {
    return { action: "clear" };
  }

  // Check for view
  if (l.view.some(phrase => lowerMsg.includes(phrase))) {
    return { action: "view" };
  }

  // Check for add/remove
  for (const action of ["add", "remove"] as const) {
    if (l[action].some(word => lowerMsg.includes(word))) {
      const query = stripCartIntent(message, action, lang);
      const foodMatch = matchFoodQuery(query, foods);
      if (foodMatch.status === "matched") return { action, food: foodMatch.food, query };
      if (foodMatch.status === "ambiguous") return { action, suggestions: foodMatch.foods, query };
      return { action, query };
    }
  }

  return null;
}

function updateCart(cart: FoodItem[], command: { action: string; food?: FoodItem; suggestions?: FoodItem[]; query?: string }, lang: "en" | "ms" | "zh"): ChatResponse {
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

function formatFoodSuggestions(foods: FoodItem[], lang: "en" | "ms" | "zh", query?: string): ChatResponse {
  const choose = {
    en: "Here are some similar foods you can try:",
    ms: "Cuba pilih daripada makanan yang serupa:",
    zh: "以下是一些相似的食物，您可以试试：",
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
  };
}

function isDailyIntakeQuestion(message: string, lang: "en" | "ms" | "zh"): boolean {
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

function formatDailyIntakeSummary(summary: DailyIntakeSummary, lang: "en" | "ms" | "zh"): string {
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
      } else if (sugarVal > 5 || fatVal > 5 || sodiumVal > 300 || giVal > 55) {
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
function stripCartIntent(message: string, action: "add" | "remove", lang: "en" | "ms" | "zh"): string {
  const normalized = normalizeFoodText(message);
  if (!normalized) return "";

  const verbsByAction: Record<string, Record<string, string[]>> = {
    en: { add: ["add", "put", "insert", "include"], remove: ["remove", "delete"] },
    ms: { add: ["tambah", "masukkan"], remove: ["buang", "padam"] },
    zh: { add: ["添加", "加入", "放"], remove: ["删除", "移除"] },
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

  const stopwordsByLang: Record<"en" | "ms" | "zh", Set<string>> = {
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
    "what about",
    "how about",
    "can i eat",
    "boleh makan",
    "adakah",
    "makanan",
    "selamat",
    "tentang",
    "可以吃",
    "安全吗",
    "营养",
    "关于",
  ];

  for (const wrapper of wrappers) {
    normalized = removeNormalizedPhrase(normalized, wrapper);
  }

  return normalized.trim().replace(/\s+/g, " ");
}

function formatUnavailableFoodName(query: string | undefined, lang: "en" | "ms" | "zh"): string {
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

function hasPartialFoodRelationship(normalizedQuery: string, normalizedName: string): boolean {
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const nameTokens = normalizedName.split(" ").filter(Boolean);

  if (!hasCjk(normalizedQuery) && !hasCjk(normalizedName)) {
    // SAFE direction only: the food name in the DB must CONTAIN the query tokens.
    // This prevents short DB names (e.g. "apple") from matching longer queries
    // (e.g. "apple juice") — which would be a dangerous false positive.
    // Require at least 2 query tokens so single-word queries never fuzzy-expand.
    if (queryTokens.length < 2) return false;
    return hasContiguousTokens(nameTokens, queryTokens);
  }

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactName = normalizedName.replace(/\s+/g, "");
  if (compactQuery === compactName) return false;

  // CJK: only match when the DB food name contains the query — same safe direction.
  return compactName.indexOf(compactQuery) !== -1;
}

function matchFoodQuery(query: string, foods: FoodItem[]): FoodMatchResult {
  const normalizedQuery = normalizeFoodText(query);
  const compactQuery = compactFoodText(query);
  if (!normalizedQuery || !compactQuery) return { status: "none" };

  const entries = foods.flatMap((food) =>
    getFoodNames(food).map((name) => ({
      food,
      name,
      normalizedName: normalizeFoodText(name),
      compactName: compactFoodText(name),
    }))
  );

  const exactMatches = uniqueFoods(entries
    .filter((entry) => entry.normalizedName === normalizedQuery || entry.compactName === compactQuery)
    .map((entry) => entry.food));

  if (exactMatches.length === 1) return { status: "matched", food: exactMatches[0] };
  if (exactMatches.length > 1) return { status: "ambiguous", foods: exactMatches.slice(0, 3) };

  const partialMatches = uniqueFoods(entries
    .filter((entry) => {
      if (entry.normalizedName === normalizedQuery || entry.compactName === compactQuery) return false;
      return hasPartialFoodRelationship(normalizedQuery, entry.normalizedName);
    })
    .sort((a, b) => b.compactName.length - a.compactName.length)
    .map((entry) => entry.food));

  if (partialMatches.length > 0) {
    return { status: "ambiguous", foods: partialMatches.slice(0, 3) };
  }

  const fuzzyMatches = entries
    .map((entry) => ({
      food: entry.food,
      score: similarityScore(compactQuery, entry.compactName),
    }))
    .sort((a, b) => b.score - a.score);

  const best = fuzzyMatches[0];
  const second = fuzzyMatches.find((match) => match.food.name.en !== best?.food.name.en);

  if (best && best.score >= 0.88 && (!second || best.score - second.score >= 0.08)) {
    return { status: "matched", food: best.food };
  }

  const closeMatches = uniqueFoods(fuzzyMatches
    .filter((match) => match.score >= 0.72)
    .map((match) => match.food));

  if (closeMatches.length > 0) {
    return { status: "ambiguous", foods: closeMatches.slice(0, 3) };
  }

  return { status: "none" };
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
- If EXACT NUTRITIONAL DATA is provided in the conversation, use those values precisely without modification or estimation.
- When answering about specific foods, use this exact format for consistency:

Nutrition for [Food Name]

Sugar: [value]
Calories: [value]
GI: [value]
Fat: [value]
Sodium: [value]

Things to note:
[if applicable] ⚠️ May raise blood sugar quickly
[if applicable] ⚠️ High in sodium and fat

Three Highs Health Tip:
[simple health tip]

For foods not in our database, use "Estimated nutrition for..." and provide reasonable estimates based on typical Malaysian foods. Use simple template-based tips like "Watch portion size" or "Choose lower sodium options".
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
  let requestLang = "en";

  try {
    const body: ChatRequest = await req.json();
    const { message, history = [], language = "en", scanContext = null, cart = [], intakeSummary } = body;
    requestLang = language ?? "en";

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Fetch food data for lookup
    const rows = await getAllFoodData();
    const foods = transformFoodRows(rows);

    // Check for cart command
    const command = parseCartCommand(message, foods, requestLang as "en" | "ms" | "zh");
    if (command) {
      if (command.action === "view") {
        const summary = intakeSummary ?? buildDailyIntakeSummary(cart, "male", requestLang as "en" | "ms" | "zh");
        return NextResponse.json({ reply: formatDailyIntakeSummary(summary, requestLang as "en" | "ms" | "zh") });
      }
      const result = updateCart(cart, command, requestLang as "en" | "ms" | "zh");
      return NextResponse.json(result);
    }

    if (isDailyIntakeQuestion(message, requestLang as "en" | "ms" | "zh")) {
      const summary = intakeSummary ?? buildDailyIntakeSummary(cart, "male", requestLang as "en" | "ms" | "zh");
      return NextResponse.json({ reply: formatDailyIntakeSummary(summary, requestLang as "en" | "ms" | "zh") });
    }

    // Check for food mention in user message
    const foodQuestionQuery = stripFoodQuestionIntent(message);
    const foodMention = matchFoodQuery(foodQuestionQuery, foods);

    const primaryKey = process.env.GROQ_API_KEY_3 ?? process.env.GROQ_API_KEY;
    const backupKey = process.env.GROQ_API_KEY_4 ?? process.env.GROQ_API_KEY_2;

    if (!primaryKey && !backupKey) {
      throw new Error("No GEMINI API keys configured");
    }

    let reply = "";

    if (foodMention.status === "matched") {
      // Exact response from dataset: nutrition + health tip
      const lang = requestLang as "en" | "ms" | "zh";
      reply = buildNutritionSection(foodMention.food, lang);
    } else if (foodMention.status === "ambiguous") {
      return NextResponse.json(formatFoodSuggestions(foodMention.foods, requestLang as "en" | "ms" | "zh", foodQuestionQuery));
    } else {
      // Normal AI conversation flow
      const systemPrompt = buildSystemPrompt(requestLang, scanContext);

      // Keep last 6 messages for context efficiency
      let conversationMessages: ChatMessage[] = [
        ...history.slice(-6),
        { role: "user", content: message },
      ];

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

    const lang = typeof requestLang === "string" ? requestLang : "en";

    return NextResponse.json(
      { reply: fallbacks[lang] ?? fallbacks["en"] },
      { status: 200 }
    );
  }
}
