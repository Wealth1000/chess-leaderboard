"use client";

import type { ChartConfiguration } from "chart.js";
import { useEffect, useMemo, useRef } from "react";
import { formatShortDate } from "@/lib/format";
import { getPlayerHistory } from "@/lib/history";
import type { RankedPlayer, Snapshot } from "@/lib/types";
import styles from "./rating-chart.module.css";

const PLATFORM_COLORS = ["#b23b1e", "#2f6b54", "#c58b1e"];

type RatingChartProps = {
  player: RankedPlayer;
  snapshots: Snapshot[];
};

export default function RatingChart({ player, snapshots }: RatingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playerSnapshots, dates, platforms } = useMemo(
    () => getPlayerHistory(snapshots, player.id),
    [player.id, snapshots],
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

      const config: ChartConfiguration<"line"> = {
        type: "line",
        data: {
          labels: dates.map(formatShortDate),
          datasets: platforms.map((platform, index) => {
            const color = PLATFORM_COLORS[index % PLATFORM_COLORS.length];
            return {
              label: platform,
              data: dates.map((date) => {
                const snapshot = playerSnapshots.find(
                  (entry) => entry.date === date,
                );
                return (
                  snapshot?.ratings.find(
                    (rating) => rating.platform === platform,
                  )?.rating ?? null
                );
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
            };
          }),
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
            legend: {
              position: "bottom",
              labels: {
                usePointStyle: true,
                pointStyle: "circle",
                boxWidth: 7,
                boxHeight: 7,
                padding: 16,
                color: "#14231d",
                font: { family: monoFont, size: 10 },
              },
            },
            tooltip: {
              backgroundColor: "#14231d",
              titleColor: "#f4ecd9",
              bodyColor: "#f4ecd9",
              padding: 10,
              titleFont: { family: monoFont, size: 10 },
              bodyFont: { family: bodyFont, size: 12 },
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
  }, [dates, platforms, player.id, playerSnapshots]);

  if (dates.length < 2) {
    return (
      <div className={styles.firstSnapshot}>
        <div className={styles.ghostLine} aria-hidden="true" />
        <p>
          <strong>
            {dates.length === 1 ? "The line starts here." : "No rating history yet."}
          </strong>{" "}
          {dates.length === 1
            ? "This is the first snapshot. Check back after the next daily update to see the trend."
            : "This player will appear on the chart after the next daily snapshot."}
        </p>
        {platforms.length ? (
          <div className={styles.platformChips}>
            {platforms.map((platform) => (
              <span className={styles.chip} key={platform}>
                {platform}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Rating history for ${player.name}`}
      />
    </div>
  );
}
