"use client";

import { useEffect, useRef } from "react";
import {
  categoryLabel,
  formatDate,
  formatNumber,
  padRank,
  platformLabel,
  rangeLabel,
} from "@/lib/format";
import type {
  PlayerScorecard,
  RatingsViewModel,
  ScorecardCell,
  ScorecardCellReason,
} from "@/lib/ratings-view";
import ChangeBadge from "./change-badge";
import RatingChart from "./rating-chart";
import styles from "./player-dialog.module.css";

type PlayerDialogProps = {
  scorecard: PlayerScorecard;
  model: RatingsViewModel;
  playerCount: number;
  onClose: () => void;
  onFocus: () => void;
};

const REASON_TEXT: Record<Exclude<ScorecardCellReason, "rated">, string> = {
  "no-account": "—",
  "not-published": "Not published",
  "not-played": "Not played",
  "no-data": "—",
};

const REASON_DESCRIPTION: Record<Exclude<ScorecardCellReason, "rated">, string> = {
  "no-account": "no account",
  "not-published": "not published",
  "not-played": "not played",
  "no-data": "no data",
};

function cellValue(cell: ScorecardCell) {
  return cell.reason === "rated"
    ? formatNumber(cell.rating)
    : REASON_TEXT[cell.reason];
}

function cellDescription(cell: ScorecardCell) {
  const base = `${platformLabel(cell.platform)} ${categoryLabel(cell.category)}`;
  const value =
    cell.reason === "rated"
      ? `${formatNumber(cell.rating)} rating`
      : REASON_DESCRIPTION[cell.reason];

  return `${base}: ${value}${cell.active ? ", active view" : ""}`;
}

export default function PlayerDialog({
  scorecard,
  model,
  playerCount,
  onClose,
  onFocus,
}: PlayerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    if (!dialog.open) dialog.showModal();

    return () => {
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, [onClose]);

  const platformName = platformLabel(model.platform);
  const categoryName = categoryLabel(model.category);
  const rangeName = rangeLabel(model.range);
  const handle = scorecard.activeCell.username;
  const rankText = scorecard.rank == null ? "—" : padRank(scorecard.rank);
  const rankDescription =
    scorecard.rank == null
      ? `${scorecard.playerName} is unrated in the current view.`
      : `${scorecard.playerName} is ranked ${scorecard.rank} of ${playerCount} in the current view.`;
  const isFocused = model.focus?.playerId === scorecard.playerId;
  const extras = scorecard.chessComExtras;
  const showExtras = Boolean(scorecard.player.chessCom || extras);
  const historyNote =
    scorecard.history.length >= 2
      ? `${rangeName} · ${scorecard.history.length} snapshots`
      : scorecard.history.length === 1
        ? `${rangeName} · 1 snapshot`
        : `${rangeName} · no snapshots`;

  return (
    <dialog
      className={styles.dialog}
      ref={dialogRef}
      aria-labelledby="dialog-name"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className={styles.scorecard}>
        <div className={styles.scorecardBar}>
          <span>
            Player scorecard · {platformName} · {categoryName}
          </span>
          <button
            type="button"
            className={styles.dialogClose}
            aria-label="Close scorecard"
            onClick={() => dialogRef.current?.close()}
          >
            ✕
          </button>
        </div>

        <div className={styles.scorecardBody}>
          <div className={styles.scorecardHead}>
            <span className={styles.scorecardRank} aria-hidden="true">
              {rankText}
            </span>
            <span className="sr-only">{rankDescription}</span>
            <div className={styles.scorecardIdentity}>
              <h2 className={styles.scorecardName} id="dialog-name">
                {scorecard.playerName}
              </h2>
              <p className={styles.scorecardPlatform}>
                {platformName} · {categoryName} ·{" "}
                {handle ?? `No ${platformName} account`}
              </p>
            </div>
            <div className={styles.scorecardRating}>
              <strong>{formatNumber(scorecard.currentRating)}</strong>
              <span>{categoryName} rating</span>
              <ChangeBadge
                change={scorecard.change}
                showDate
                className={styles.ratingChange}
              />
            </div>
          </div>

          <div className={styles.matrixBlock}>
            <div className={styles.blockTitleRow}>
              <h3>Full rating profile</h3>
              <span>{platformName} · {categoryName} active</span>
            </div>
            <div
              className={styles.matrixScroll}
              role="region"
              aria-label={`Rating matrix for ${scorecard.playerName}`}
              tabIndex={0}
            >
              <table className={styles.matrix}>
                <caption>
                  Rating profile by category and platform. Active view:{" "}
                  {platformName} {categoryName}.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Chess.com</th>
                    <th scope="col">Lichess</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecard.matrix.map((row) => (
                    <tr key={row.category}>
                      <th scope="row">{categoryLabel(row.category)}</th>
                      {(["chess.com", "lichess"] as const).map((platform) => {
                        const cell = row.cells[platform];
                        const classNames = [
                          styles.matrixCell,
                          cell.reason === "rated"
                            ? styles.ratedCell
                            : styles.missingCell,
                          cell.active ? styles.activeCell : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <td className={classNames} key={platform}>
                            <span aria-hidden="true">{cellValue(cell)}</span>
                            <span className="sr-only">
                              {cellDescription(cell)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showExtras ? (
            <div className={styles.extrasBlock}>
              <div className={styles.blockTitleRow}>
                <h3>Chess.com extras</h3>
                <span>Not ranked ratings</span>
              </div>
              <dl className={styles.extras}>
                <div>
                  <dt>Tactics high</dt>
                  <dd>{formatNumber(extras?.tacticsHigh)}</dd>
                </div>
                <div>
                  <dt>Puzzle Rush best</dt>
                  <dd>{formatNumber(extras?.puzzleRushBest)}</dd>
                </div>
              </dl>
              <p className={styles.extrasNote}>
                Tactics high and Puzzle Rush best are shown for context. They
                are not current puzzle ratings and do not enter the leaderboard
                or focus comparisons.
              </p>
            </div>
          ) : null}

          <div className={styles.chartBlock}>
            <div className={styles.chartTitleRow}>
              <h3>
                {platformName} {categoryName} history
              </h3>
              <span>{historyNote}</span>
            </div>
            <RatingChart
              playerName={scorecard.playerName}
              platform={model.platform}
              category={model.category}
              range={model.range}
              history={scorecard.history}
            />
          </div>

          <dl className={styles.scorecardStats}>
            <div>
              <dt>Rank</dt>
              <dd>
                {scorecard.rank == null
                  ? "Unrated"
                  : `#${rankText} of ${playerCount}`}
              </dd>
            </div>
            <div>
              <dt>Snapshot</dt>
              <dd>{formatDate(model.latestDate)}</dd>
            </div>
            <div>
              <dt>Range</dt>
              <dd>{rangeName}</dd>
            </div>
          </dl>

          <div className={styles.scorecardActions}>
            <button
              type="button"
              className={styles.focusAction}
              onClick={onFocus}
            >
              {isFocused ? "Compare nearby players" : "Focus this player"}
            </button>
            <p>
              Closes this scorecard, activates Focus mode, and scrolls to the
              composite chart.
            </p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
