"use client";

import type { ChartConfiguration } from "chart.js";
import { useEffect, useMemo, useRef } from "react";
import { formatNumber, formatShortDate, platformLabel } from "@/lib/format";
import type { Platform, Player, Snapshot } from "@/lib/types";
import styles from "./field-chart.module.css";

const TOP_COLORS = ["#b23b1e", "#2f6b54", "#c58b1e", "#28516b", "#7a3b62"];
const FIELD_COLOR = "rgba(20, 35, 29, 0.22)";

type FieldChartProps = {
  players: Player[];
  snapshots: Snapshot[];
  platform: Platform;
  loading: boolean;
  warning: boolean;
};

type FieldSeries = {
  player: Player;
  points: Map<string, number>;
  latestRating: number;
};

export default function FieldChart({
  players,
  snapshots,
  platform,
  loading,
  warning,
}: FieldChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const platformName = platformLabel(platform);

  const { dates, series } = useMemo(() => {
    const playerById = new Map(
      players.map((player) => [player.id, player] as const),
    );
    const pointsByPlayer = new Map<string, Map<string, number>>();
    const dateSet = new Set<string>();

    for (const snapshot of snapshots) {
      const rating = snapshot.ratings.find(
        (entry) =>
          entry.platform === platform && typeof entry.rating === "number",
      );
      if (!rating || rating.rating == null) continue;

      let points = pointsByPlayer.get(snapshot.playerId);
      if (!points) {
        points = new Map<string, number>();
        pointsByPlayer.set(snapshot.playerId, points);
      }
      points.set(snapshot.date, rating.rating);
      dateSet.add(snapshot.date);
    }

    const dates = [...dateSet].sort();
    const series: FieldSeries[] = [];

    pointsByPlayer.forEach((points, playerId) => {
      const player = playerById.get(playerId);
      const latestDate = [...points.keys()].sort().at(-1);
      if (!player || !latestDate) return;

      series.push({
        player,
        points,
        latestRating: points.get(latestDate) ?? 0,
      });
    });

    series.sort((a, b) => b.latestRating - a.latestRating);

    return { dates, series };
  }, [platform, players, snapshots]);

  const leaders = useMemo(() => series.slice(0, 5), [series]);

  useEffect(() => {
    if (!dates.length || !series.length) return;

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
      const hasHistory = dates.length > 1;
      const topIds = new Set(leaders.map((entry) => entry.player.id));

      const config: ChartConfiguration<"line"> = {
        type: "line",
        data: {
          labels: dates.map(formatShortDate),
          datasets: series.map(({ player, points }) => {
            const topIndex = leaders.findIndex(
              (entry) => entry.player.id === player.id,
            );
            const isTop = topIds.has(player.id);
            const color =
              topIndex >= 0 ? TOP_COLORS[topIndex] : FIELD_COLOR;

            return {
              label: player.name,
              data: dates.map((date) => points.get(date) ?? null),
              borderColor: color,
              backgroundColor: color,
              borderWidth: isTop ? 2.2 : 1,
              pointRadius: hasHistory ? (isTop ? 3 : 0) : isTop ? 4 : 2.5,
              pointHoverRadius: 6,
              pointBackgroundColor: color,
              pointBorderColor: "#f4ecd9",
              pointBorderWidth: isTop ? 1.5 : 1,
              tension: 0.24,
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
            : { duration: 480 },
          interaction: { mode: "nearest", intersect: true },
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
                  `${context.dataset.label}: ${formatNumber(context.parsed.y)}`,
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
                autoSkip: true,
                maxTicksLimit: 8,
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
  }, [dates, leaders, series]);

  const hasData = series.length > 0;
  const note =
    dates.length === 1
      ? "One snapshot so far. Lines begin after the next daily update."
      : `${dates.length} snapshots · ${series.length} rated ${
          series.length === 1 ? "player" : "players"
        }`;

  return (
    <section className={styles.section} aria-labelledby="field-heading">
      <div className={styles.sectionHead}>
        <div>
          <p className="eyebrow eyebrowLight">Composite ratings</p>
          <h2 id="field-heading">The whole field.</h2>
        </div>
        <p className={styles.sectionNote}>
          {platformName} · one line per player
        </p>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.cardHead}>
          <div className={styles.legend} aria-label="Top five players">
            {leaders.map((entry, index) => (
              <span className={styles.legendItem} key={entry.player.id}>
                <span
                  className={styles.swatch}
                  style={{ background: TOP_COLORS[index] }}
                  aria-hidden="true"
                />
                <span className={styles.legendRank}>{index + 1}</span>
                <span className={styles.legendName}>{entry.player.name}</span>
                <span className={styles.legendRating}>
                  {formatNumber(entry.latestRating)}
                </span>
              </span>
            ))}
          </div>
          <p className={styles.chartNote}>
            {loading ? "Loading…" : hasData ? note : `${platformName} · no data`}
          </p>
        </div>

        {loading ? (
          <div className={styles.empty}>Plotting the field…</div>
        ) : !hasData ? (
          <div className={styles.empty}>
            {warning
              ? "Ratings did not load. Reload the page to try again."
              : `No ${platformName} ratings have been recorded yet.`}
          </div>
        ) : (
          <>
            <div className={styles.chartWrap}>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`${platformName} rating history for ${
                  series.length === 1
                    ? "the 1 rated player"
                    : `all ${series.length} rated players`
                }`}
              />
            </div>
            {dates.length === 1 ? (
              <p className={styles.snapshotNote}>
                Each dot is a player in the first snapshot. The lines will grow
                as daily ratings are collected.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
