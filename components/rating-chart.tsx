"use client";

import type { ChartConfiguration } from "chart.js";
import { useEffect, useRef } from "react";
import {
  categoryLabel,
  formatNumber,
  formatShortDate,
  platformLabel,
  rangeLabel,
} from "@/lib/format";
import type { ScorecardHistoryPoint } from "@/lib/ratings-view";
import type { Category, Platform, RangeKey } from "@/lib/types";
import styles from "./rating-chart.module.css";

const PLATFORM_COLORS: Record<Platform, string> = {
  "chess.com": "#b23b1e",
  lichess: "#2f6b54",
};

type RatingChartProps = {
  playerName: string;
  platform: Platform;
  category: Category;
  range: RangeKey;
  history: ScorecardHistoryPoint[];
};

export default function RatingChart({
  playerName,
  platform,
  category,
  range,
  history,
}: RatingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const platformName = platformLabel(platform);
  const categoryName = categoryLabel(category);
  const rangeName = rangeLabel(range);

  useEffect(() => {
    if (history.length < 2) return;

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
          labels: history.map((point) => formatShortDate(point.date)),
          datasets: [
            {
              label: `${categoryName} rating`,
              data: history.map((point) => point.rating),
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
                  `${categoryName} rating: ${formatNumber(context.parsed.y)}`,
                footer: () => `${platformName} · ${rangeName}`,
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
              title: {
                display: true,
                text: `${categoryName} rating`,
                color: "#5d6c60",
                font: { family: monoFont, size: 9 },
              },
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
  }, [categoryName, history, platform, platformName, rangeName]);

  if (history.length < 2) {
    return (
      <div className={styles.firstSnapshot}>
        <div className={styles.ghostLine} aria-hidden="true" />
        <p>
          <strong>
            {history.length === 1
              ? `The ${categoryName.toLowerCase()} line starts here.`
              : `No ${categoryName.toLowerCase()} history in this range.`}
          </strong>{" "}
          {history.length === 1
            ? `This is the first ${categoryName.toLowerCase()} rating for ${playerName} on ${platformName} in the ${rangeName} range. Check back after the next daily update to see the trend.`
            : `${playerName} has no ${platformName} ${categoryName.toLowerCase()} ratings in the ${rangeName} range. Try another range or check back after the next snapshot.`}
        </p>
        <div className={styles.platformChips}>
          <span className={styles.chip}>{platformName}</span>
          <span className={styles.chip}>{categoryName}</span>
          <span className={styles.chip}>{rangeName}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${platformName} ${categoryName} rating history for ${playerName}, ${rangeName} range`}
      />
    </div>
  );
}
