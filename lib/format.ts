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

export function platformLabel(platforms: string[]) {
  if (!platforms.length) return "No data";
  if (platforms.length > 1) return `${platforms.length} platforms`;
  return platforms[0] === "chess.com" ? "Chess.com" : "Lichess";
}
