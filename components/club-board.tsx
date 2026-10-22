"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatNumber, padRank, platformLabel } from "@/lib/format";
import { BOARD_SQUARES, getSeatInfo } from "@/lib/leaderboard";
import type { RankedPlayer } from "@/lib/types";
import styles from "./board.module.css";

type ClubBoardProps = {
  ranked: RankedPlayer[];
  loading: boolean;
  warning: boolean;
  onSelect: (player: RankedPlayer) => void;
};

function initialTileClass(index: number) {
  const row = Math.floor(index / 8);
  const column = index % 8;
  return (row + column) % 2 === 0 ? styles.tileLight : styles.tileDark;
}

export default function ClubBoard({
  ranked,
  loading,
  warning,
  onSelect,
}: ClubBoardProps) {
  const [query, setQuery] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);

  const needle = query.trim().toLowerCase();
  const filtering = needle.length > 0;
  const visiblePlayers = useMemo(
    () =>
      filtering
        ? ranked.filter((player) => player.aliasText.includes(needle))
        : ranked,
    [filtering, needle, ranked],
  );

  const seats = getSeatInfo(ranked.length);
  const hasSnapshots = ranked.some((player) => player.snapshot);

  const applyParity = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;

    const columns =
      getComputedStyle(board).gridTemplateColumns.split(" ").filter(Boolean)
        .length || 8;

    Array.from(board.children).forEach((child, index) => {
      const tile = child as HTMLElement;
      if (!tile.classList.contains(styles.tile)) return;

      const row = Math.floor(index / columns);
      const column = index % columns;
      const isLight = (row + column) % 2 === 0;

      tile.classList.toggle(styles.tileLight, isLight);
      tile.classList.toggle(styles.tileDark, !isLight);
    });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(applyParity);
    return () => cancelAnimationFrame(frame);
  }, [applyParity, visiblePlayers]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const observer = new ResizeObserver(applyParity);
    observer.observe(board);
    return () => observer.disconnect();
  }, [applyParity]);

  let countLabel = `${ranked.length} players`;
  if (loading) countLabel = "Loading…";
  else if (filtering) countLabel = `${visiblePlayers.length} of ${ranked.length}`;

  let notice: string | null = null;
  if (!loading) {
    if (warning) {
      notice =
        "Ratings did not load. The player list is here, but ratings are unavailable. Reload the page to try again.";
    } else if (!hasSnapshots) {
      notice =
        "No snapshots yet. The board will rank players after the next daily update.";
    }
  }

  return (
    <section className={styles.boardSection} aria-labelledby="board-heading">
      <div className={styles.sectionHead}>
        <div>
          <p className="eyebrow eyebrowLight">The club board</p>
          <h2 id="board-heading">Every player, ranked.</h2>
        </div>
        <div className={styles.boardTools}>
          <div className={styles.searchWrap}>
            <label htmlFor="player-search" className="sr-only">
              Search players
            </label>
            <input
              id="player-search"
              type="search"
              placeholder="Find a player"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className={styles.boardCount}>{countLabel}</span>
        </div>
      </div>

      <div className={styles.board} id="board" ref={boardRef} aria-live="polite">
        {loading ? (
          <div className={styles.boardMessage}>Reading the board…</div>
        ) : visiblePlayers.length === 0 ? (
          <div className={styles.boardMessage}>
            <div>
              <strong>No player matches “{query.trim()}”.</strong>
              Try a name or username from the group.
            </div>
          </div>
        ) : (
          <>
            {visiblePlayers.map((player, index) => {
              const className = [
                styles.tile,
                initialTileClass(index),
                player.rank === 1
                  ? styles.tileLeader
                  : player.rank <= 3
                    ? styles.tilePodium
                    : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  type="button"
                  className={className}
                  key={player.id}
                  aria-label={`Number ${player.rank}: ${player.name}, ${
                    player.rating == null
                      ? "unrated"
                      : `${player.rating} rating`
                  }. Open scorecard.`}
                  onClick={() => onSelect(player)}
                >
                  <span className={styles.tileTop}>
                    <span className={styles.tileRank}>{padRank(player.rank)}</span>
                    <span className={styles.tilePlatform}>
                      {platformLabel(player.platforms)}
                    </span>
                  </span>
                  <span className={styles.tileName} title={player.name}>
                    {player.name}
                  </span>
                  <span className={styles.tileRating}>
                    {formatNumber(player.rating)}
                  </span>
                </button>
              );
            })}

            {!filtering &&
              visiblePlayers.length < BOARD_SQUARES &&
              Array.from(
                { length: BOARD_SQUARES - visiblePlayers.length },
                (_, offset) => {
                  const index = visiblePlayers.length + offset;
                  return (
                    <div
                      className={`${styles.tile} ${styles.tileOpen} ${initialTileClass(index)}`}
                      key={`open-${index}`}
                      aria-hidden="true"
                    >
                      <span className={styles.tileTop}>
                        <span className={styles.tileRank}>—</span>
                      </span>
                      <span className={styles.openMark}>+</span>
                      <span className={styles.openLabel}>Open seat</span>
                    </div>
                  );
                },
              )}
          </>
        )}
      </div>

      <div className={styles.boardFoot}>
        <p>Click any square for a player scorecard and rating history.</p>
        <p className={styles.seatNote}>{loading ? "—" : seats.note}</p>
      </div>

      {notice ? <p className={styles.dataNotice}>{notice}</p> : null}
    </section>
  );
}
