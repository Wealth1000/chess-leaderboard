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

const PLATFORM_COLOR_TOKENS: Record<Platform, string> = {
  "chess.com": "--chart-series-1",
  lichess: "--chart-series-2",
};

const PLATFORM_COLOR_FALLBACKS: Record<Platform, string> = {
  "chess.com": "#b23b1e",
  lichess: "#2f6b54",
};

function readColorToken(
  style: CSSStyleDeclaration,
  name: string,
  fallback: string,
) {
  return style.getPropertyValue(name).trim() || fallback;
}

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
      const color = readColorToken(
        rootStyle,
        PLATFORM_COLOR_TOKENS[platform],
        PLATFORM_COLOR_FALLBACKS[platform],
      );
      const tooltipBg = readColorToken(
        rootStyle,
        "--chart-tooltip-bg",
        "#14231d",
      );
      const tooltipText = readColorToken(
        rootStyle,
        "--chart-tooltip-text",
        "#f6eedc",
      );
      const tooltipBorder = readColorToken(
        rootStyle,
        "--chart-tooltip-border",
        "rgba(246, 238, 220, 0.26)",
      );
      const tickColor = readColorToken(rootStyle, "--chart-tick", "#5f6f64");
      const gridColor = readColorToken(
        rootStyle,
        "--chart-grid",
        "rgba(20, 35, 29, 0.08)",
      );
      const axisColor = readColorToken(
        rootStyle,
        "--chart-axis",
        "rgba(20, 35, 29, 0.18)",
      );
      const pointBorderColor = readColorToken(
        rootStyle,
        "--chart-point-border",
        "#fbf6e8",
      );

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
              pointBorderColor,
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
          layout: { padding: { top: 10, right: 10, bottom: 2, left: 4 } },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tooltipBg,
              titleColor: tooltipText,
              bodyColor: tooltipText,
              borderColor: tooltipBorder,
              borderWidth: 1,
              cornerRadius: 0,
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
              border: { color: axisColor },
              ticks: {
                color: tickColor,
                maxRotation: 0,
                font: { family: monoFont, size: 9 },
              },
            },
            y: {
              beginAtZero: false,
              border: { display: false },
              grid: { color: gridColor },
              title: {
                display: true,
                text: `${categoryName} rating`,
                color: tickColor,
                font: { family: monoFont, size: 9 },
              },
              ticks: {
                color: tickColor,
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
