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
- **AI / LLM:** [Groq API](https://groq.com/) — Llama-4-Scout (OCR) + Llama-3.3-70B (analysis)
- **Charts & Maps:** Recharts, react-simple-maps, D3
- **Deployment:** [Vercel](https://vercel.com/)
- **Package Manager:** pnpm

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- A [Neon](https://neon.tech/) PostgreSQL database (free tier works)
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

# Groq API keys (Key 2 is primary, Key 1 is fallback)
GROQ_API_KEY=gsk_your_primary_key
GROQ_API_KEY_2=gsk_your_secondary_key
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

---

## 📖 Usage Examples

### AI Food Recommendation

1. Navigate to the **Home** page (or `/recommendation`).
2. Upload up to **5 photos** of restaurant menu and food, or type food items manually.
3. Click **Analyse** — the app extracts every food item using Llama-4-Scout OCR, then ranks them by diabetes risk (Low / Medium / High) across four categories: Appetizer, Main Dish, Dessert, and Drinks.
4. Each result shows estimated **sugar (g)**, **sodium (mg)**, **fat (g)**, a **health tip**, and the top-ranked item's **reason for recommendation**.
5. If all recommended food in a food category are all high risk, an alternative food will be suggested.

### Food Explorer

1. Go to `/food`.
2. Filter by cuisine category (Malaysian, Chinese, Indian, etc.) or search by name.
3. Tap any food card to view its **calorie count**, **GI**, **daily sugar impact**, and a **personalised health tip**.
4. Switch languages using the flag selector in the navbar.

### Dietary Planner

1. Go to `/food`.
2. Tap the **Add to Plan** button on any food card to add the food into the meal plan.
3. Tap **View Plan** button on the top right corner.
4. View the **total sugar**, **sodium**, and **fat** intake against recommended daily allowances and **total calories**.

### "Three Highs" Statistics

1. Go to `/statistics`.
2. View the **national trend chart** to see how prevalence has changed over the years.
3. Interact with the **choropleth map** to explore diabetes prevalence by Malaysian state.
4. Check the **ethnicity breakdown** chart for community-level insights.
5. Get additional useful information 

### "Three Highs" Learn 

1. Go to `/learn`.
2. Learn about diabetes and its partners (The "Three Highs") at **"Three Highs" Literacy Hub**.
3. Explore how the "Three Highs" affect your body at **Interactive Body Map**.
4. Debunk myth and learn about facts at **Myth Debunker**.

### Healthcare Facility Finder

1. Go to `/healthcare`.
2. Enable location to find out the nearest healthcare facility.
3. Filter healthcare facility by **state**, **sector**, and **specialty**.
4. View healthcare facility information such as **name**, **address**, **contact number**, **ratings**, **sector**, and **get directions**.


---

## 📁 Project Structure

```
manis/
├── app/
│   ├── api/predict/        # AI food & menu analysis API route (Groq)
│   ├── archive/            # Archived content / past iterations
│   ├── learn/              # "Three Highs" Literacy Hub, Interactive Body MapMyth Buster page
│   ├── food/               # Food Explorer, Dietary Planner page
│   ├── healthcare/         # Healthcare Facility Finder
│   ├── statistics/         # "Three Highs" statistics & map
│   └── recommendation/     # AI Food Recommendation (home page)
├── components/
│   ├── ui/                 # shadcn/ui component library
│   ├── ai-chatbot.tsx      # AI chat interface
│   ├── malaysia-choropleth-map.tsx  # Interactive state map
│   └── navbar.tsx          # Navigation with language switcher
├── db/
│   ├── index.ts            # Neon database client
│   └── schema.ts           # Drizzle ORM table definitions
├── lib/
│   ├── queries.ts          # Database query functions
│   └── utils.ts            # Utility helpers
├── public/
│   ├── data/malaysia.geojson  # GeoJSON for state map
│   └── images/             # Food and educational images
└── drizzle.config.ts       # Drizzle Kit configuration
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
- AI Input & Food Detection
- AI Recommendation & Decision Support
- Diabetes Education & Awareness

### Iteration 2 (Archived)
- Food explorer with the three highs for common Malaysian foods
- Three highs statistics overview with state-level map
- Learning about the three highs, interactive body map and Myth Buster feature
- Multilingual support (EN / MS / ZH)

### Iteration 3 (Current)
- Healthcare Facility Finder (nearby clinic/hospital locator)
- AI Conversational Health Assistant

### Tagging a Release

```bash
git tag -a v1.0 -m "End of Iteration 1"
git push origin v1.0
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
