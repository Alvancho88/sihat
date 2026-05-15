/** Cross-page sync: food analysis is ready → chatbot may show the scan/menu hint. */

export const ANALYSIS_READY_EVENT = "sihat-analysis-ready";
export const LAST_ACK_ANALYSIS_HINT_ID_KEY = "sihat_last_ack_analysis_hint_id";
export const ANALYSIS_SESSION_KEY = "sihat_analysis_session";

export type AnalysisReadySource =
  | "food-recognition"
  | "chatbot-typed"
  | "chatbot-photo"
  | "chatbot-view-detail"
  | "recommendation-restore";

export type AnalysisReadyDetail = {
  analysisId: string;
  source: AnalysisReadySource;
  timestamp: number;
  foodNames?: string[];
};

export function createAnalysisId(): string {
  return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Stable id for one analysis result (same food set + timestamp). Used for session + hint deduping.
 * Format: `${source}-${foodSlug}-${timestamp}`
 */
export function buildStableAnalysisSessionId(
  source: string,
  foodNames: string[],
  timestamp: number
): string {
  const slug = foodNames
    .map((n) =>
      n
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-_\u4e00-\u9fff]/gi, "")
        .slice(0, 40)
    )
    .filter(Boolean)
    .join("-");
  const safeSource = source.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "analysis";
  return `${safeSource}-${slug || "unknown"}-${timestamp}`;
}

export function notifyAnalysisReady(
  detail: Omit<AnalysisReadyDetail, "timestamp"> & { timestamp?: number }
): void {
  if (typeof window === "undefined") return;
  const payload: AnalysisReadyDetail = {
    ...detail,
    timestamp: detail.timestamp ?? Date.now(),
  };
  window.dispatchEvent(new CustomEvent(ANALYSIS_READY_EVENT, { detail: payload }));
}

export function readAcknowledgedAnalysisHintId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LAST_ACK_ANALYSIS_HINT_ID_KEY);
}

export function markAnalysisHintAcknowledged(analysisId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LAST_ACK_ANALYSIS_HINT_ID_KEY, analysisId);
}

export function clearAcknowledgedAnalysisHintId(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LAST_ACK_ANALYSIS_HINT_ID_KEY);
}

export function readAnalysisIdFromSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sessionRaw = sessionStorage.getItem(ANALYSIS_SESSION_KEY);
    if (!sessionRaw) return null;
    const session = JSON.parse(sessionRaw) as { analysisId?: string; createdAt?: number };
    if (session.analysisId) return session.analysisId;
    if (session.createdAt) return `legacy-${session.createdAt}`;
    return null;
  } catch {
    return null;
  }
}

export function extractFoodNamesFromPredictResults(
  data: Record<string, unknown>
): string[] {
  const names: string[] = [];
  for (const key of ["Main Dish", "Appetizer", "Dessert", "Drinks"]) {
    const cat = data[key] as { ranking?: Array<{ f?: string }> } | undefined;
    for (const item of cat?.ranking ?? []) {
      if (item?.f) names.push(item.f);
    }
  }
  return names;
}
