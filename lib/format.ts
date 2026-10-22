import type { Category, Platform, RangeKey } from "@/lib/types";

export const PLATFORM_LABELS: Record<Platform, string> = {
  "chess.com": "Chess.com",
  lichess: "Lichess",
};

export const PLATFORMS: Platform[] = ["chess.com", "lichess"];

export const CATEGORY_LABELS: Record<Category, string> = {
  rapid: "Rapid",
  classical: "Classical / Daily",
  blitz: "Blitz",
  bullet: "Bullet",
  puzzle: "Puzzle",
};

export const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
  all: "All",
};

export const padRank = (rank: number) => String(rank).padStart(2, "0");

export const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("en-US");

export function formatDate(isoDate: string) {
  if (!isoDate) return "—";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function platformLabel(platform: Platform) {
  return PLATFORM_LABELS[platform];
}

export function categoryLabel(category: Category) {
  return CATEGORY_LABELS[category];
}

export function rangeLabel(range: RangeKey) {
  return RANGE_LABELS[range];
}
