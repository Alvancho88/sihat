# 🍚 SIHAT - Seniors' Integrated Health Assessment Tool

> **FIT5120 Industry Experience Project — TM02 Quintet**

**SIHAT** (SIHAT - Seniors' Integrated Health Assessment Tool) is a multilingual web application designed to combat the rising rates of metabolic syndrome and non-infectious diseases (NIDs) among Malaysians. While the name sihat (Malay for healthy) reflects a holistic approach to wellness, the platform specifically targets the "Three Highs": High Blood Sugar **(Hyperglycemia)**, High Blood Pressure **(Hypertension)**, and High Blood Fat **(Hyperlipidemia)**.

---

## ✨ Features

| Feature | Description |
|---|---|
| **AI Food Recommendation** | Upload a photo of a restaurant menu or a food and get an instant nutritional breakdown ranked by "three high" risk (sugar, salt, saturated fat) with food recommendation. |
| **Food Explorer** | Browse an extensive database of everyday Malaysian dishes detailing calories, sugar, sodium, fat, and Glycemic Index (GI) levels, complete with localised, multilingual health tips. |
| **Dietary Planner** | Track and aggregate daily sugar, sodium, and fat intake against recommended daily allowances to build balanced, heart-healthy meal plans. |
| **Three Highs Overview** | Explore interactive choropleth maps and dynamic charts tracking the prevalence of "three highs" prevalence across Malaysian states and ethnic groups. |
| **Three Highs Literacy Hub** | Access a curated library of bite-sized education cards introducing the "three highs", their symptoms, factors and practical prevention strategies. |
| **Interactive Body Map** | Visually explore an interactive anatomical map to understand exactly how "three highs" impact different organs. |
| **Myth Buster** | Debunks common "three highs" misconceptions with evidence-based facts. |
| **Healthcare Facility Finder** | Easily locate nearby public and private healthcare facilities specialising in "three highs" screening. |
| **Multilingual Support** | Full UI in English 🇬🇧, Bahasa Malaysia 🇲🇾, and Mandarin 🇨🇳. |

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router) with React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, Radix UI, shadcn/ui
- **Database:** PostgreSQL via [Neon](https://neon.tech/) (serverless), [Drizzle ORM](https://orm.drizzle.team/)
- **AI / LLM:** [Google AI Studio API](https://aistudio.google.com/) — gemma-4-31b-it and llama-4-scout-17b-16e-instruct (OCR) + [Groq API](https://groq.com/) — Llama-3.3-70B (analysis and chatbot)
- **Charts & Maps:** Recharts, react-simple-maps, D3
- **Deployment:** [Vercel](https://vercel.com/)
- **Package Manager:** pnpm

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- A [Neon](https://neon.tech/) PostgreSQL database (free tier works)
- A [Google AI Studio](https://aistudio.google.com/) API key (free tier available)
- A [Groq](https://console.groq.com/) API key (free tier available)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/manis.git
cd manis

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
```

Edit `.env.local` and fill in the required values:

```env
# Neon PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Google API keys (Key 1 is primary, Key 2,3,4 is fallback)
GOOGLE_API_KEY=AIz_your_primary_key
GOOGLE_API_KEY_2=AIz_your_backup_key
GOOGLE_API_KEY_3=AIz_your_backup_key
GOOGLE_API_KEY_4=AIz_your_backup_key

# Groq API keys (Key 1 and 3 is primary, Key 2,4,5 is fallback)
GROQ_API_KEY=gsk_your_primary_key
GROQ_API_KEY_2=gsk_your_secondary_key
GROQ_API_KEY_3=gsk_your_primary_key
GROQ_API_KEY_4=gsk_your_secondary_key
GROQ_API_KEY_5=gsk_your_secondary_key
```

### Database Setup

```bash
# Push the schema to your Neon database
pnpm drizzle-kit push
```

Seed the database with Malaysian diabetes statistics (state-level, national trend, and ethnicity data) using your preferred method (Drizzle Studio or a seed script).

### Running Locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Examples
 
### AI Food Recommendation
 
1. Navigate to the **Home** page (or `/recommendation`).
2. Upload up to **5 photos** of restaurant menus or food dishes, or type food items manually.
3. Click **Analyse** — the app extracts every food item using Gemma-4 / Llama-4-Scout OCR, then ranks them by Three Highs risk (Low / Medium / High) across four categories: Appetizer, Main Dish, Dessert, and Drinks.
4. Each result shows estimated **sugar (g)**, **sodium (mg)**, **saturated fat (g)**, a **health tip**, and the top-ranked item's **reason for recommendation**.
5. If all items in a category are High Risk, a **healthier alternative food** is automatically suggested above the ranking.
6. Tap the floating **Siti** chatbot button to ask follow-up health questions about any scanned item.
### Food Explorer
 
1. Go to `/food`.
2. Filter by cuisine category (Malaysian, Chinese, Indian, etc.) or search by name.
3. Sort by any nutrient (Sugar / Calories / GI / Fat / Sodium) in ascending or descending order.
4. Tap any food card to view its **calorie count**, **GI**, **daily sugar impact**, **fat**, **sodium**, and a **personalised health tip**.
5. Switch languages using the flag selector in the navbar.
### Dietary Planner
 
1. Go to `/food`.
2. Tap the **Add to Plan** button on any food card to add the food to your daily meal plan.
3. Tap **View Plan** on the top right corner to open the Daily Intake panel.
4. Select your **gender** to apply the correct recommended daily limits.
5. View **total sugar**, **sodium**, **fat**, and **calories** tracked against recommended daily allowances with visual progress bars.
### "Three Highs" Statistics
 
1. Go to `/statistics`.
2. View the **national trend chart** to see how prevalence of diabetes, hypertension, and hyperlipidemia has changed over the last decade.
3. Interact with the **choropleth map** to explore Three Highs prevalence by Malaysian state — tap a state for a detailed breakdown of all three conditions.
4. Check the **ethnicity breakdown** grouped bar chart for community-level insights across ethnic groups in Malaysia.
5. Review the **summary statistics cards** for a quick overview of the Three Highs crisis in Malaysia.
### "Three Highs" Learn
 
1. Go to `/learn`.
2. Learn about the Three Highs (diabetes, hypertension, hyperlipidemia) at the **Three Highs Literacy Hub**.
3. Explore how the Three Highs affect your body at the **Interactive Body Map** — tap any organ to see its comorbidity breakdown.
4. Debunk myths and learn evidence-based facts at **Myth Buster**.
### Healthcare Facility Finder
 
1. Go to `/healthcare`.
2. Allow location access to automatically sort clinics by **nearest distance**, or search manually by area.
3. Filter by **state**, **sector** (Public / Private), and **specialty** (Diabetes / Blood Pressure / Cholesterol).
4. View each facility's **name**, **address**, **contact number**, **rating**, **sector**, and **distance**.
5. Tap **Call Clinic** to dial directly from your device, or **Get Directions** to open navigation in Google Maps.
### Siti — AI Conversational Health Assistant
 
1. Tap the floating **Siti** chat button available on any page.
2. Ask health questions about the Three Highs in **English, Bahasa Malaysia, or Simplified Chinese**.
3. Reference foods from your current scan (e.g. *"Can I eat the Char Kway Teow I just scanned?"*) for context-aware advice.
4. Add foods mentioned in the chat directly to your **Daily Plan** via Siti's cart commands.
5. Ask *"What's my daily intake so far?"* for an instant summary of your nutrition plan.
6. All responses are general dietary guidance only — a disclaimer is shown in the chat interface.
---

## 📁 Project Structure
 
```
sihat/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # Siti chatbot API (Groq Llama-3.3-70B, intent routing, multi-key fallback)
│   │   └── predict/route.ts    # AI food & menu analysis API (OCR + nutritional analysis, Groq/Google AI)
│   ├── archive/                # Archived content from past iterations
│   ├── food/                   # Food Explorer & Dietary Planner
│   │   ├── food-client.tsx     # Client component (search, filter, sort, cart)
│   │   └── page.tsx
│   ├── healthcare/             # Healthcare Facility Finder
│   │   ├── healthcare-client.tsx  # Client component (geolocation, filters, pagination)
│   │   └── page.tsx
│   ├── learn/                  # Three Highs Literacy Hub, Interactive Body Map, Myth Buster
│   │   ├── learn-client.tsx
│   │   └── page.tsx
│   ├── recommendation/         # AI Food Recommendation (home page)
│   │   ├── recommendation-client.tsx  # Client component (upload, OCR, analysis, alternative suggestion)
│   │   └── page.tsx
│   └── statistics/             # Three Highs statistics, choropleth map, trend charts
│       ├── statistics-client.tsx
│       └── page.tsx
├── components/
│   ├── ui/                          # shadcn/ui component library
│   ├── ai-chatbot.tsx               # Siti floating chatbot (intent classification, scan context, cart commands)
│   ├── body-map.tsx                 # Interactive SVG anatomical body map
│   ├── cart-context.tsx             # Global cart/daily-intake state (React Context)
│   ├── daily-intake-panel.tsx       # Daily nutrition summary panel with progress bars
│   ├── malaysia-choropleth-map.tsx  # Interactive state-level choropleth map (D3 + react-simple-maps)
│   ├── menu-scan-cta.tsx            # "Scan your menu" call-to-action component
│   ├── navbar.tsx                   # Navigation with language switcher (EN / MS / ZH)
│   ├── page-layout.tsx              # Shared page wrapper with header and footer
│   ├── three-highs-insights.tsx     # Three Highs statistics insight cards
│   └── three-highs-popup.tsx        # Three Highs detail pop-up panel
├── db/
│   ├── index.ts                     # Neon serverless database client
│   └── schema.ts                    # Drizzle ORM table definitions (foods, facilities, statistics)
├── lib/
│   ├── analysis-hint-sync.ts        # Syncs chatbot AI estimates with recommendation page
│   ├── daily-intake-summary.ts      # Daily nutrition aggregation helpers
│   ├── food-data-transform.ts       # Food data normalisation and transformation utilities
│   ├── food-functions.ts            # Food search, filter, and sort logic
│   ├── food-recognition-risk.ts     # Three Highs risk threshold calculations
│   ├── queries.ts                   # Database query functions (foods, facilities, statistics)
│   └── utils.ts                     # General utility helpers
├── public/
│   ├── data/
│   │   └── malaysia.geojson         # GeoJSON boundaries for Malaysian state choropleth map
│   └── images/
│       ├── body-map/                # Organ and body map SVG/image assets
│       ├── edu/                     # Educational content images
│       ├── food-page/               # Food card images
│       └── home-page/               # Recommendation page images
├── drizzle.config.ts                # Drizzle Kit configuration
├── next.config.mjs                  # Next.js configuration
└── vercel.json                      # Vercel deployment configuration
```
 
---

## 🌐 Deployment

The project is configured for **Vercel** deployment (`vercel.json` included).

```bash
# Deploy via Vercel CLI
vercel deploy
```

Set the same environment variables (`DATABASE_URL`, `GROQ_API_KEY`, `GROQ_API_KEY_2`) in your Vercel project settings under **Settings → Environment Variables**.

---

## 🔁 Iteration Notes
 
### Iteration 1 (Archived)
- AI menu image upload and food item extraction (OCR via LLM)
- AI-powered nutritional analysis with Low / Medium / High Three Highs risk ranking
- Best choice recommendation with health tips per food item
- Baseline English UI
### Iteration 2 (Archived)
- Food Explorer with nutritional details (sugar, calories, GI, fat, sodium) for common Malaysian foods
- Dietary Planner (shopping cart) with daily intake tracking and progress bars against recommended limits
- Three Highs statistics overview with interactive choropleth map, national trend chart, and ethnicity breakdown
- Three Highs Literacy Hub, Interactive Body Map, and Myth Buster
- Multilingual support (EN / MS / ZH) across all pages
### Iteration 3 (Current)
- **Healthcare Facility Finder** — GPS-based nearest clinic/hospital locator with filter by state, sector, and Three Highs specialty; direct dial and Google Maps navigation
- **Siti — AI Conversational Health Assistant** — floating multilingual chatbot (EN / MS / ZH) with context-aware food scan advice, daily intake queries, cart commands, and safe health guidance (Groq Llama-3.3-70B)
- **High-Risk Alternative Suggestion** — when all items in a food category are High Risk, a contextually relevant healthier alternative is automatically recommended
- **Upgraded OCR model** — switched to Gemma-4-31b-it (Google AI Studio) as primary OCR model with Llama-4-Scout as fallback, improving accuracy on dense and image-heavy menus

### Tagging a Release
 
```bash
git tag -a v3.0 -m "End of Iteration 3"
git push origin v3.0
```
---

## 🤝 Contributing

This is an academic project for FIT5120 at Monash University. Contributions from team members follow the workflow defined in `.github/CODEOWNERS`.

---

## 📄 License

See [LICENSE](./LICENSE) for details.

---

## ⚠️ Disclaimer

The nutritional information and health tips provided by this application are for **educational purposes only** and should not replace professional medical advice. Please consult a qualified healthcare provider for personalised dietary guidance, especially if you have or suspect diabetes.
