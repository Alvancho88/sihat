export type FoodItem = {
  name: string
  category: string
  image: string
  calories: string
  sugar: string
  gi: string
  fat: string
  sodium: string
  portion: string
  risk: "low" | "medium" | "high"
  tip: { en: string; ms: string; zh: string }
}

// Get level helpers
export function getSugarLevel(sugar: string): "low" | "medium" | "high" {
  const value = parseInt(sugar.replace(/[^0-9]/g, ''), 10)
  if (value <= 5) return "low"
  if (value <= 15) return "medium"
  return "high"
}

export function getGILevel(gi: string): "low" | "medium" | "high" {
  const value = parseInt(gi.replace(/[^0-9]/g, ''), 10)
  if (value <= 55) return "low"
  if (value <= 69) return "medium"
  return "high"
}

export function getFatLevel(fat: string): "low" | "medium" | "high" {
  const value = parseInt(fat.replace(/[^0-9]/g, ''), 10)
  if (value <= 5) return "low"
  if (value <= 15) return "medium"
  return "high"
}

export function getSodiumLevel(sodium: string): "low" | "medium" | "high" {
  const value = parseInt(sodium.replace(/[^0-9]/g, ''), 10)
  if (value <= 300) return "low"
  if (value <= 600) return "medium"
  return "high"
}

// Daily limits for elderly
export const dailyLimits = {
  sugar:   { men: 36,   women: 25,   unit: "g"    },
  fat:     { men: 78,   women: 62,   unit: "g"    }, // Based on ~2500 kcal men / ~2000 kcal women at 28% fat
  sodium:  { men: 2000, women: 2000, unit: "mg"   }, // WHO recommendation (same for both)
  cal:     { men: 2500, women: 2000, unit: "kcal" }, // Approximate daily energy needs
  gi:      { men: 55,   women: 55,   unit: ""     }, // Average GI target (low GI = ≤55)
}

// Categories
export const categories = {
  en: ["All", "Malaysian", "Chinese", "Indian", "Western", "Japanese", "Korean", "Desserts", "Drinks", "Fruits"],
  ms: ["Semua", "Malaysia", "Cina", "India", "Barat", "Jepun", "Korea", "Pencuci", "Minuman", "Buah"],
  zh: ["全部", "马来菜", "中餐", "印度菜", "西餐", "日式", "韩式", "甜点", "饮料", "水果"],
}
