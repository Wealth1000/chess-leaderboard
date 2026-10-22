"use client";

import type { ChartConfiguration } from "chart.js";
import { useEffect, useMemo, useRef } from "react";
import { formatNumber, formatShortDate, platformLabel } from "@/lib/format";
import { getPlayerHistory } from "@/lib/history";
import type { Platform, RankedPlayer, Snapshot } from "@/lib/types";
import styles from "./rating-chart.module.css";

const PLATFORM_COLORS: Record<Platform, string> = {
  "chess.com": "#b23b1e",
  lichess: "#2f6b54",
};

type RatingChartProps = {
  player: RankedPlayer;
  snapshots: Snapshot[];
  platform: Platform;
};

export default function RatingChart({
  player,
  snapshots,
  platform,
}: RatingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const platformName = platformLabel(platform);
  const { playerSnapshots, dates } = useMemo(
    () => getPlayerHistory(snapshots, player.id, platform),
    [player.id, platform, snapshots],
  );

  useEffect(() => {
    if (dates.length < 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let chart: import("chart.js").Chart | null = null;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled) return;

      const rootStyle = getComputedStyle(document.documentElement);
      const monoFont =
        rootStyle.getPropertyValue("--mono").trim() || "monospace";
      const bodyFont =
        rootStyle.getPropertyValue("--body").trim() || "sans-serif";
      const color = PLATFORM_COLORS[platform];

      const config: ChartConfiguration<"line"> = {
        type: "line",
        data: {
          labels: dates.map(formatShortDate),
          datasets: [
            {
              label: platformName,
              data: dates.map((date) => {
                const snapshot = playerSnapshots.find(
                  (entry) => entry.date === date,
                );
                return snapshot?.ratings[0]?.rating ?? null;
              }),
              borderColor: color,
              backgroundColor: color,
              borderWidth: 2.5,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: color,
              pointBorderColor: "#f4ecd9",
              pointBorderWidth: 1.5,
              tension: 0.28,
              spanGaps: true,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? false
            : { duration: 420 },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#14231d",
              titleColor: "#f4ecd9",
              bodyColor: "#f4ecd9",
              padding: 10,
              titleFont: { family: monoFont, size: 10 },
              bodyFont: { family: bodyFont, size: 12 },
              callbacks: {
                label: (context) =>
                  `${platformName}: ${formatNumber(context.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { color: "rgba(20, 35, 29, 0.22)" },
              ticks: {
                color: "#5d6c60",
                maxRotation: 0,
                font: { family: monoFont, size: 9 },
              },
            },
            y: {
              beginAtZero: false,
              border: { display: false },
              grid: { color: "rgba(20, 35, 29, 0.12)" },
              ticks: {
                color: "#5d6c60",
                precision: 0,
                font: { family: monoFont, size: 9 },
              },
            },
          },
        },
      };

      chart = new Chart(canvas, config);
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [dates, platform, platformName, player.id, playerSnapshots]);

  if (dates.length < 2) {
    return (
      <div className={styles.firstSnapshot}>
        <div className={styles.ghostLine} aria-hidden="true" />
        <p>
          <strong>
            {dates.length === 1
              ? "The line starts here."
              : `No ${platformName} history yet.`}
          </strong>{" "}
          {dates.length === 1
            ? "This is the first snapshot. Check back after the next daily update to see the trend."
            : `This player has no ${platformName} ratings in the snapshots.`}
        </p>
        <div className={styles.platformChips}>
          <span className={styles.chip}>{platformName}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${platformName} rating history for ${player.name}`}
      />
    </div>
  );
}
