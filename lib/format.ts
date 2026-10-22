import type { Platform } from "@/lib/types";

export const PLATFORM_LABELS: Record<Platform, string> = {
  "chess.com": "Chess.com",
  lichess: "Lichess",
};

export const PLATFORMS: Platform[] = ["chess.com", "lichess"];

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
