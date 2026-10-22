"use client";

import { useEffect, useMemo, useRef } from "react";
import { formatDate, formatNumber, padRank, platformLabel } from "@/lib/format";
import { getPlayerHistory } from "@/lib/history";
import type { Platform, RankedPlayer, Snapshot } from "@/lib/types";
import RatingChart from "./rating-chart";
import styles from "./player-dialog.module.css";

type PlayerDialogProps = {
  player: RankedPlayer;
  snapshots: Snapshot[];
  latestDate: string;
  leader: RankedPlayer | null;
  playerCount: number;
  platform: Platform;
  onClose: () => void;
};

export default function PlayerDialog({
  player,
  snapshots,
  latestDate,
  leader,
  playerCount,
  platform,
  onClose,
}: PlayerDialogProps) {
  const platformName = platformLabel(platform);
  const handle = platform === "chess.com" ? player.chessCom : player.lichess;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { dates } = useMemo(
    () => getPlayerHistory(snapshots, player.id, platform),
    [player.id, platform, snapshots],
  );

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

  const rankText = player.rating == null ? "—" : padRank(player.rank);
  const gapText =
    player.rating == null
      ? "—"
      : leader && leader.id !== player.id && leader.rating != null
        ? `−${formatNumber(leader.rating - player.rating)}`
        : "Leader";
  const historyNote =
    dates.length >= 2
      ? `${dates.length} snapshots`
      : dates.length === 1
        ? "1 snapshot"
        : "No history yet";

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
          <span>Player scorecard · {platformName}</span>
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
            <div>
              <h2 className={styles.scorecardName} id="dialog-name">
                {player.name}
              </h2>
              <p className={styles.scorecardPlatform}>
                {handle ? `${platformName} · ${handle}` : `No ${platformName} account`}
              </p>
            </div>
            <div className={styles.scorecardRating}>
              <strong>{formatNumber(player.rating)}</strong>
              <span>rating</span>
            </div>
          </div>

          <div className={styles.chartBlock}>
            <div className={styles.chartTitleRow}>
              <h3>{platformName} history</h3>
              <span>{historyNote}</span>
            </div>
            <RatingChart
              player={player}
              snapshots={snapshots}
              platform={platform}
            />
          </div>

          <dl className={styles.scorecardStats}>
            <div>
              <dt>Rank</dt>
              <dd>
                {player.rating == null
                  ? "Unrated"
                  : `#${rankText} of ${playerCount}`}
              </dd>
            </div>
            <div>
              <dt>Behind leader</dt>
              <dd>{gapText}</dd>
            </div>
            <div>
              <dt>Snapshot</dt>
              <dd>{formatDate(latestDate)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </dialog>
  );
}
