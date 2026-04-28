import { timestamptz } from "drizzle-orm/gel-core";
import { year } from "drizzle-orm/mysql-core";
import { pgTable, serial, text, integer, timestamp, doublePrecision, varchar, decimal, date } from "drizzle-orm/pg-core";

// Table 1: State Information (Static Info)
export const states = pgTable("states", {
    state_id: serial("id").primaryKey(),
    state_name: text("name").notNull(),
});

// Table 2: Three High Data (Static Info)
export const metabolic = pgTable("metabolic", {
    stats_id: serial("id").primaryKey(),
    state_id: integer("state_id").notNull().references(() => states.state_id),
    year: integer("year").notNull(),
    patients: integer("patients").notNull(),
    diabetesPrevalence: decimal("diabetes_prevalence").notNull(),
    hypertensionPrevalence: decimal("hypertension_prevalence").notNull(),
    hyperlipidemiaPrevalence: decimal("hyperlipidemia_prevalence").notNull(),
});

// Table 3: National Trend (Static Info)
export const trend = pgTable("trend", {
    trend_id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    patients: integer("patients").notNull(),
    diabetesPrevalence: decimal("diabetes_prevalence").notNull(),
    hypertensionPrevalence: decimal("hypertension_prevalence").notNull(),
    hyperlipidemiaPrevalence: decimal("hyperlipidemia_prevalence").notNull(),
});

// Table 4: Three High Data by Ethnicity (Static Info)
export const ethnicity = pgTable("ethnicity", {
    id: serial("id").primaryKey(),
    ethnicity: varchar("ethnicity").notNull(),
    diabetesPrevalence: decimal("diabetes_prevalence").notNull(),
    hypertensionPrevalence: decimal("hypertension_prevalence").notNull(),
    hyperlipidemiaPrevalence: decimal("hyperlipidemia_prevalence").notNull(),
});

// Table 5: Food Nutrition Data (Static Info)
export const food = pgTable("food", {
    food_id: integer("food_id").primaryKey(),
    food_type: text("food_type").notNull(),
    serving_size: text("serving_size").notNull(),
    calories: integer("calories_kcal").notNull(),
    sugar: doublePrecision("sugar_g").notNull(),
    gi_value: integer("gi_value").notNull(),
    fat: doublePrecision("fat_g").notNull(),
    sodium: integer("sodium_mg").notNull(),
    image_url: text("image_url").notNull(),
});

// Table 6: Food Data Translations (Static Info)
export const food_translations = pgTable("food_translations", {
    translation_id: serial("translation_id").primaryKey(),
    food_id: integer("food_id").notNull().references(() => food.food_id),
    language: varchar("language", { length: 2 }).notNull(), // "en", "ms", "zh"
    food_name: text("food_name").notNull(),
    health_tip: text("health_tip").notNull(),
}); 