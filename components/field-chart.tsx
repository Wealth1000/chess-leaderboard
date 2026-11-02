"use client";

import type { ChartConfiguration } from "chart.js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  categoryLabel,
  formatDate,
  formatNumber,
  formatShortDate,
  platformLabel,
  rangeLabel,
} from "@/lib/format";
import type { ChartSeries, FocusModel, RatingsViewModel } from "@/lib/ratings-view";
import {
  chartAxisCeiling,
  chartOutliersAbove,
} from "@/lib/chart-scale";
import type { Player, RatingChange } from "@/lib/types";
import ChangeBadge from "./change-badge";
import styles from "./field-chart.module.css";

const TOP_SERIES_TOKENS = [
  "--chart-series-1",
  "--chart-series-2",
  "--chart-series-3",
  "--chart-series-4",
  "--chart-series-5",
] as const;

const TOP_SERIES_FALLBACKS = [
  "#b23b1e",
  "#2f6b54",
  "#96661a",
  "#28516b",
  "#7a3b62",
] as const;

function readColorToken(
  style: CSSStyleDeclaration,
  name: string,
  fallback: string,
) {
  return style.getPropertyValue(name).trim() || fallback;
}

type ChartMode = "field" | "focus";

type FieldChartProps = {
  model: RatingsViewModel;
  players: Player[];
  loading: boolean;
  warning: boolean;
  mode: ChartMode;
  fullChartRange: boolean;
  onModeChange: (mode: ChartMode) => void;
  onFocusPlayer: (playerId: string) => void;
  onClearFocus: () => void;
  onFullChartRangeChange: (fullChartRange: boolean) => void;
};

function signed(value: number | null | undefined) {
  if (value == null) return "—";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`;
}

function pointsByDate(series: ChartSeries) {
  return new Map(series.points.map((point) => [point.date, point.value]));
}

function changeForFocus(focus: FocusModel, latestDate: string): RatingChange {
  const delta = focus.totalChange;

  return {
    delta,
    direction:
      delta == null ? "unavailable" : delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    comparisonDate: focus.baselineDate,
    latestDate: latestDate || null,
  };
}

export default function FieldChart({
  model,
  loading,
  warning,
  mode,
  fullChartRange,
  onModeChange,
  onFocusPlayer,
  onClearFocus,
  onFullChartRangeChange,
}: FieldChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const platformName = platformLabel(model.platform);
  const categoryName = categoryLabel(model.category);
  const rangeName = rangeLabel(model.range);
  const field = model.field;
  const focus = model.focus;
  const needsFocus = mode === "focus" && !focus;
  const showPicker = pickerOpen || needsFocus;

  // The clamp is computed from the lines that are actually plotted, so it can
  // never disagree with the legend or the hidden-player rule above it.
  const plottedValues = useMemo(
    () =>
      field.series
        .map((series) => series.latestValue)
        .filter((value): value is number => value != null),
    [field.series],
  );
  const clampCeiling = useMemo(
    () => chartAxisCeiling(plottedValues, false),
    [plottedValues],
  );
  const axisCeiling = fullChartRange ? null : clampCeiling;
  const outliers =
    clampCeiling == null ? 0 : chartOutliersAbove(plottedValues, clampCeiling);

  const focusChange = useMemo(
    () => (focus ? changeForFocus(focus, model.latestDate) : null),
    [focus, model.latestDate],
  );

  const filteredPlayers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return model.ranked;
    return model.ranked.filter((player) => player.aliasText.includes(needle));
  }, [model.ranked, query]);

  const focusReady =
    !!focus &&
    !focus.missingRating &&
    focus.dates.length >= 2 &&
    !!focus.focusSeries;

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;
    let chart: import("chart.js").Chart | null = null;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rootStyle = getComputedStyle(document.documentElement);
      const monoFont =
        rootStyle.getPropertyValue("--mono").trim() || "monospace";
      const bodyFont =
        rootStyle.getPropertyValue("--body").trim() || "sans-serif";
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
      const fieldColor = readColorToken(
        rootStyle,
        "--chart-field-trace",
        "rgba(95, 127, 150, 0.18)",
      );
      const peerColor = readColorToken(
        rootStyle,
        "--chart-peer",
        "rgba(95, 127, 150, 0.48)",
      );
      const bandColor = readColorToken(
        rootStyle,
        "--chart-band",
        "rgba(95, 127, 150, 0.14)",
      );
      const medianColor = readColorToken(
        rootStyle,
        "--chart-median",
        "#4f7288",
      );
      const topColors = TOP_SERIES_TOKENS.map((token, index) =>
        readColorToken(rootStyle, token, TOP_SERIES_FALLBACKS[index]),
      );
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const chartLayout = {
        padding: { top: 10, right: 10, bottom: 2, left: 4 },
      };

      let config: ChartConfiguration<"line">;

      if (mode === "focus" && focus && focus.focusSeries) {
        const dates = focus.dates;
        const focusPoints = pointsByDate(focus.focusSeries);
        const bandByDate = new Map(focus.band.map((entry) => [entry.date, entry]));

        config = {
          type: "line",
          data: {
            labels: dates.map(formatShortDate),
            datasets: [
              {
                label: "Peer minimum",
                data: dates.map((date) => bandByDate.get(date)?.min ?? null),
                borderColor: "transparent",
                backgroundColor: "transparent",
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                order: 3,
              },
              {
                label: "Peer range",
                data: dates.map((date) => bandByDate.get(date)?.max ?? null),
                borderColor: "transparent",
                backgroundColor: bandColor,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: "-1",
                order: 3,
              },
              ...focus.peerSeries.map((series) => {
                const points = pointsByDate(series);
                return {
                  label: series.playerName,
                  data: dates.map((date) => points.get(date) ?? null),
                  borderColor: peerColor,
                  backgroundColor: peerColor,
                  borderWidth: 1.1,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  pointBackgroundColor: peerColor,
                  pointBorderColor,
                  pointBorderWidth: 1,
                  tension: 0.22,
                  spanGaps: true,
                  fill: false,
                  order: 2,
                };
              }),
              {
                label: `${focus.playerName} (focused)`,
                data: dates.map((date) => focusPoints.get(date) ?? null),
                borderColor: topColors[0],
                backgroundColor: topColors[0],
                borderWidth: 3,
                pointRadius: 3.5,
                pointHoverRadius: 6,
                pointBackgroundColor: topColors[0],
                pointBorderColor,
                pointBorderWidth: 1.5,
                tension: 0.24,
                spanGaps: true,
                fill: false,
                order: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: reducedMotion ? false : { duration: 480 },
            layout: chartLayout,
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
                filter: (item) =>
                  item.dataset.label !== "Peer range" &&
                  item.dataset.label !== "Peer minimum",
                callbacks: {
                  label: (context) =>
                    `${context.dataset.label}: ${signed(context.parsed.y)} pts`,
                  footer: () =>
                    focus.baselineDate
                      ? `Change from ${formatDate(focus.baselineDate)}`
                      : "Rating change",
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
                  autoSkip: true,
                  maxTicksLimit: 8,
                  font: { family: monoFont, size: 9 },
                },
              },
              y: {
                beginAtZero: false,
                border: { display: false },
                grid: { color: gridColor },
                title: {
                  display: true,
                  text: `${categoryName} rating change (points)`,
                  color: tickColor,
                  font: { family: monoFont, size: 9 },
                },
                ticks: {
                  color: tickColor,
                  precision: 0,
                  callback: (value) => signed(Number(value)),
                  font: { family: monoFont, size: 9 },
                },
              },
            },
          },
        };
      } else {
        const dates = field.dates;
        const leaders = field.leaders;
        const topIds = new Set(leaders.map((entry) => entry.playerId));
        const hasHistory = dates.length > 1;
        const bandByDate = new Map(
          field.band.map((entry) => [entry.date, entry]),
        );

        config = {
          type: "line",
          data: {
            labels: dates.map(formatShortDate),
            datasets: [
              {
                label: "Middle 50% minimum",
                data: dates.map((date) => bandByDate.get(date)?.min ?? null),
                borderColor: "transparent",
                backgroundColor: "transparent",
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                order: 5,
              },
              {
                label: "Middle 50% maximum",
                data: dates.map((date) => bandByDate.get(date)?.max ?? null),
                borderColor: "transparent",
                backgroundColor: bandColor,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: "-1",
                order: 5,
              },
              {
                label: "Median",
                data: dates.map((date) => bandByDate.get(date)?.median ?? null),
                borderColor: medianColor,
                backgroundColor: medianColor,
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBackgroundColor: medianColor,
                pointBorderColor,
                pointBorderWidth: 1,
                tension: 0.2,
                spanGaps: true,
                fill: false,
                order: 2,
              },
              ...field.series.map((series) => {
                const points = pointsByDate(series);
                const topIndex = leaders.findIndex(
                  (entry) => entry.playerId === series.playerId,
                );
                const isTop = topIds.has(series.playerId);
                const color = topIndex >= 0 ? topColors[topIndex] : fieldColor;

                return {
                  label: series.playerName,
                  data: dates.map((date) => points.get(date) ?? null),
                  borderColor: color,
                  backgroundColor: color,
                  borderWidth: isTop ? 2.2 : 1,
                  pointRadius: hasHistory ? (isTop ? 3 : 0) : isTop ? 4 : 2.5,
                  pointHoverRadius: 6,
                  pointBackgroundColor: color,
                  pointBorderColor,
                  pointBorderWidth: isTop ? 1.5 : 1,
                  tension: 0.24,
                  spanGaps: true,
                  fill: false,
                  order: isTop ? 1 : 3,
                };
              }),
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: reducedMotion ? false : { duration: 480 },
            layout: chartLayout,
            interaction: { mode: "nearest", intersect: false },
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
                filter: (item) =>
                  item.dataset.label !== "Middle 50% minimum" &&
                  item.dataset.label !== "Middle 50% maximum",
                callbacks: {
                  label: (context) =>
                    `${context.dataset.label}: ${formatNumber(
                      context.parsed.y,
                    )} ${categoryName.toLowerCase()} rating`,
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
                  autoSkip: true,
                  maxTicksLimit: 8,
                  font: { family: monoFont, size: 9 },
                },
              },
              y: {
                beginAtZero: false,
                max: axisCeiling ?? undefined,
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
      }

      chart = new Chart(canvas, config);
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [
    axisCeiling,
    categoryName,
    field,
    focus,
    focusReady,
    mode,
    model.latestDate,
  ]);

  const choosePlayer = (playerId: string) => {
    onFocusPlayer(playerId);
    onModeChange("focus");
    setPickerOpen(false);
    setQuery("");
  };

  const clearFocus = () => {
    onClearFocus();
    onModeChange("field");
    setPickerOpen(false);
    setQuery("");
  };

  const modeLabel = mode === "field" ? "Field mode" : "Focus mode";
  const canvasLabel =
    mode === "field"
      ? `${platformName} ${categoryName} category ratings, ${rangeName} range, field mode. Middle 50% band, median line, top five players, and ${
          field.series.length
        } player ${field.series.length === 1 ? "trace" : "traces"}.`
      : focus
        ? `${platformName} ${categoryName} rating change, ${rangeName} range, focus mode. ${focus.playerName} compared with ${focus.peers.length} nearby ${
            focus.peers.length === 1 ? "player" : "players"
          }${focus.baselineDate ? ` since ${formatDate(focus.baselineDate)}` : ""}.`
        : `${platformName} ${categoryName} rating change, ${rangeName} range, focus mode. No player selected.`;

  const fieldNote =
    field.dates.length === 1
      ? "One snapshot in range. Lines begin after the next daily update."
      : `${field.dates.length} snapshots · ${field.series.length} rated ${
          field.series.length === 1 ? "player" : "players"
        }`;

  return (
    <section
      className={styles.section}
      id="composite-chart"
      aria-labelledby="composite-heading"
    >
      <div className={styles.sectionHead}>
        <div>
          <p className="eyebrow eyebrowLight">Composite ratings</p>
          <h2 id="composite-heading">
            Field and focus.
            <span className="sr-only">
              {" "}
              {platformName} {categoryName}, {rangeName} range, {modeLabel}.
            </span>
          </h2>
        </div>
        <p className={styles.sectionNote}>
          {platformName} · {categoryName} · {rangeName} · {modeLabel}
        </p>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.controlBar}>
          <div
            className={styles.modeToggle}
            role="group"
            aria-label="Composite chart mode"
          >
            <button
              type="button"
              className={styles.modeButton}
              aria-pressed={mode === "field"}
              onClick={() => onModeChange("field")}
            >
              Field
            </button>
            <button
              type="button"
              className={styles.modeButton}
              aria-pressed={mode === "focus"}
              onClick={() => onModeChange("focus")}
            >
              Focus
            </button>
          </div>

          <div className={styles.focusBar}>
            {focus ? (
              <span className={styles.focusStatus}>
                Focused <strong>{focus.playerName}</strong>
              </span>
            ) : null}
            <button
              type="button"
              className={styles.findButton}
              aria-expanded={showPicker}
              onClick={() => setPickerOpen((open) => !open)}
            >
              {focus ? "Change player" : "Find a player"}
            </button>
            {focus ? (
              <button
                type="button"
                className={styles.textButton}
                onClick={clearFocus}
              >
                Show whole field
              </button>
            ) : null}
          </div>
        </div>

        {showPicker ? (
          <div
            className={styles.picker}
            role="group"
            aria-label="Focus player picker"
          >
            <label htmlFor="focus-player-search" className="sr-only">
              Search all players to focus
            </label>
            <input
              id="focus-player-search"
              type="search"
              placeholder="Search all players"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <p className={styles.pickerNote} aria-live="polite">
              {filteredPlayers.length}{" "}
              {filteredPlayers.length === 1 ? "player" : "players"} · unrated
              players are flagged but can still be focused
            </p>
            {filteredPlayers.length ? (
              <ul className={styles.pickerList}>
                {filteredPlayers.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      className={styles.pickerOption}
                      aria-pressed={focus?.playerId === player.id}
                      onClick={() => choosePlayer(player.id)}
                    >
                      <span className={styles.pickerName}>
                        {player.name}
                      </span>
                      <span className={styles.pickerMeta}>
                        {player.rating == null
                          ? player.handle
                            ? "Unrated in this view"
                            : `No ${platformName} account`
                          : `${formatNumber(player.rating)} · #${player.rank}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.pickerEmpty}>
                No player matches “{query.trim()}”.
              </p>
            )}
          </div>
        ) : null}

        {mode === "field" ? (
          <>
            <div className={styles.cardHead}>
              <div
                className={styles.legend}
                aria-label="Top five players and field key"
              >
                {field.leaders.map((entry, index) => (
                  <span className={styles.legendItem} key={entry.playerId}>
                    <span
                      className={styles.swatch}
                      style={{ background: `var(${TOP_SERIES_TOKENS[index]})` }}
                      aria-hidden="true"
                    />
                    <span className={styles.legendRank}>{index + 1}</span>
                    <span className={styles.legendName}>{entry.playerName}</span>
                    <span className={styles.legendRating}>
                      {formatNumber(entry.latestValue)}
                    </span>
                  </span>
                ))}
              </div>
              <p className={styles.chartNote}>
                {loading
                  ? "Loading…"
                  : field.hasData
                    ? fieldNote
                    : `${platformName} · no data in range`}
              </p>
            </div>

            {!loading && field.hasData ? (
              <div className={styles.fieldKey} aria-label="Chart key">
                <span className={styles.fieldKeyItem}>
                  <span className={styles.keyBand} aria-hidden="true" />
                  Middle 50%
                </span>
                <span className={styles.fieldKeyItem}>
                  <span className={styles.keyMedian} aria-hidden="true" />
                  Median
                </span>
                <span className={styles.fieldKeyItem}>
                  <span className={styles.keyTrace} aria-hidden="true" />
                  All {field.series.length}{" "}
                  {field.series.length === 1 ? "player" : "players"}
                </span>
              </div>
            ) : null}

            {!loading && field.hasData && clampCeiling != null ? (
              <p className={styles.clampNote}>
                {fullChartRange ? (
                  <>
                    <span>
                      Full range · {outliers}{" "}
                      {outliers === 1 ? "player" : "players"} above the usual
                      view
                    </span>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => onFullChartRangeChange(false)}
                    >
                      Clamp to {formatNumber(clampCeiling)}
                    </button>
                  </>
                ) : (
                  <>
                    <span>
                      Axis ends at {formatNumber(clampCeiling)} · {outliers}{" "}
                      {outliers === 1 ? "player" : "players"} above
                    </span>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => onFullChartRangeChange(true)}
                    >
                      Show full range
                    </button>
                  </>
                )}
              </p>
            ) : null}

            {loading ? (
              <div className={styles.empty}>Plotting the field…</div>
            ) : !field.hasData ? (
              <div className={styles.empty}>
                {warning
                  ? "Ratings did not load. Reload the page to try again."
                  : `No ${platformName} ${categoryName} ratings in the ${rangeName} range.`}
              </div>
            ) : (
              <>
                <div className={styles.chartWrap}>
                  <canvas ref={canvasRef} role="img" aria-label={canvasLabel} />
                </div>
                {field.dates.length === 1 ? (
                  <p className={styles.snapshotNote}>
                    Each dot is a player in the first snapshot in this range.
                    The lines will grow as daily ratings are collected.
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : (
          <>
            {!focus ? (
              <div className={styles.focusState} role="status">
                <p className={styles.focusStateTitle}>
                  Choose a player to compare.
                </p>
                <p>
                  Focus mode plots rating change from a common baseline and
                  compares it with nearby players. Search above for any player;
                  unrated players remain selectable.
                </p>
              </div>
            ) : loading ? (
              <div className={styles.empty}>Preparing focus comparison…</div>
            ) : warning ? (
              <div className={styles.empty}>
                Ratings did not load. Reload the page to try again.
              </div>
            ) : focus.missingRating ? (
              <div className={styles.focusState} role="status">
                <p className={styles.focusStateTitle}>
                  No {categoryName} rating in this view.
                </p>
                <p>
                  {focus.playerName} has no {platformName} {categoryName} rating
                  in the latest snapshot. Focus stays selected when you switch
                  category or platform, so the comparison will return as soon as
                  a rating is recorded.
                </p>
              </div>
            ) : (
              <>
                <dl className={styles.focusSummary}>
                  <div>
                    <dt>Current rating</dt>
                    <dd>{formatNumber(focus.currentRating)}</dd>
                  </div>
                  <div>
                    <dt>Change this range</dt>
                    <dd>
                      {focus.dates.length >= 2 && focusChange ? (
                        <ChangeBadge change={focusChange} showDate />
                      ) : (
                        "—"
                      )}
                    </dd>
                    <span className={styles.summaryMeta}>
                      {focus.dates.length >= 2 && focus.baselineDate
                        ? `from ${formatDate(focus.baselineDate)}`
                        : "begins after the next snapshot"}
                    </span>
                  </div>
                  <div>
                    <dt>Peer average</dt>
                    <dd>
                      {focus.dates.length >= 2
                        ? signed(focus.peerAverageChange)
                        : "—"}
                    </dd>
                    <span className={styles.summaryMeta}>
                      over the same period
                    </span>
                  </div>
                  <div>
                    <dt>Position</dt>
                    <dd>
                      {focus.dates.length >= 2 && focus.position != null
                        ? `#${focus.position} of ${focus.groupSize}`
                        : "—"}
                    </dd>
                    <span className={styles.summaryMeta}>by growth</span>
                  </div>
                  <div>
                    <dt>Peers</dt>
                    <dd>{focus.peers.length}</dd>
                    <span className={styles.summaryMeta}>
                      within 200 points at baseline
                    </span>
                  </div>
                </dl>

                {focus.smallGroup ? (
                  <p className={styles.groupNote}>
                    {focus.peers.length === 0
                      ? "No other player was rated within 200 points at the baseline, so this comparison has no peers."
                      : `Only ${focus.peers.length} ${
                          focus.peers.length === 1 ? "peer" : "peers"
                        } qualified within 200 points at the baseline. The comparison group is small.`}
                  </p>
                ) : null}

                {focus.dates.length < 2 ? (
                  <div className={styles.focusState} role="status">
                    <p className={styles.focusStateTitle}>
                      Growth begins after the next snapshot.
                    </p>
                    <p>
                      {focus.playerName} has{" "}
                      {focus.dates.length === 1
                        ? "one rated snapshot"
                        : "no rated snapshots"}{" "}
                      in the {rangeName} range. The focus comparison starts after
                      the next daily update, rather than inventing progress from
                      a single point.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={styles.chartWrap}>
                      <canvas
                        ref={canvasRef}
                        role="img"
                        aria-label={canvasLabel}
                      />
                    </div>
                    <p className={styles.snapshotNote}>
                      {focus.playerName} is the bold line. Muted lines are{" "}
                      {focus.peers.length}{" "}
                      {focus.peers.length === 1 ? "peer" : "peers"} rated within
                      200 points at the {focus.baselineDate ? formatDate(focus.baselineDate) : "baseline"}{" "}
                      baseline. The shaded band spans the peer minimum to
                      maximum change.
                    </p>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
