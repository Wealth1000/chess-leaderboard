"use client";

import { useCallback, useMemo, useState } from "react";
import { useSnapshots } from "@/hooks/use-snapshots";
import { useViewState } from "@/hooks/use-view-state";
import { buildRatingsView } from "@/lib/ratings-view";
import type { Player } from "@/lib/types";
import ClubBoard from "./club-board";
import FieldChart from "./field-chart";
import Hero from "./hero";
import Masthead from "./masthead";
import PlayerDialog from "./player-dialog";
import ViewBar from "./view-bar";
import styles from "./leaderboard.module.css";

type LeaderboardProps = {
  players: Player[];
};

type ChartMode = "field" | "focus";

export default function Leaderboard({ players }: LeaderboardProps) {
  const { snapshots, status } = useSnapshots();
  const { view, setPlatform, setCategory, setRange, setFocusPlayer } =
    useViewState();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("field");

  const loading = status === "loading";
  const warning = status === "warning";

  const model = useMemo(
    () => buildRatingsView(players, snapshots, view),
    [players, snapshots, view],
  );

  const selectedScorecard = selectedPlayerId
    ? (model.scorecards[selectedPlayerId] ?? null)
    : null;

  const focusName = useMemo(() => {
    if (!view.focusPlayerId) return null;
    return (
      model.focus?.playerName ??
      players.find((player) => player.id === view.focusPlayerId)?.name ??
      null
    );
  }, [model.focus, players, view.focusPlayerId]);

  const closeDialog = useCallback(() => setSelectedPlayerId(null), []);

  const clearFocus = useCallback(() => {
    setFocusPlayer(null);
    setChartMode("field");
  }, [setFocusPlayer]);

  const focusPlayer = useCallback(
    (playerId: string) => {
      setFocusPlayer(playerId);
      setChartMode("focus");
    },
    [setFocusPlayer],
  );

  const focusFromScorecard = useCallback(() => {
    if (!selectedPlayerId) return;

    setSelectedPlayerId(null);
    setFocusPlayer(selectedPlayerId);
    setChartMode("focus");

    requestAnimationFrame(() => {
      document
        .getElementById("composite-chart")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedPlayerId, setFocusPlayer]);

  return (
    <div className={styles.shell}>
      <Masthead latestDate={model.latestDate} loading={loading} />

      <ViewBar
        view={view}
        focusName={focusName}
        onPlatformChange={setPlatform}
        onCategoryChange={setCategory}
        onRangeChange={setRange}
        onClearFocus={clearFocus}
      />

      {model.notice?.kind === "chesscom-puzzle" ? (
        <div className={styles.notice} role="status">
          <p>
            <strong>Chess.com does not publish a current puzzle rating.</strong>{" "}
            Puzzle rankings are available for Lichess players. The board will
            stay on Chess.com until you choose to switch.
          </p>
          <button
            type="button"
            className={styles.noticeAction}
            onClick={() => setPlatform("lichess")}
          >
            Switch to Lichess
          </button>
        </div>
      ) : null}

      <main>
        <Hero model={model} loading={loading} warning={warning} />
        <ClubBoard
          model={model}
          loading={loading}
          warning={warning}
          onSelect={setSelectedPlayerId}
        />
        <FieldChart
          model={model}
          players={players}
          loading={loading}
          warning={warning}
          mode={chartMode}
          onModeChange={setChartMode}
          onFocusPlayer={focusPlayer}
          onClearFocus={clearFocus}
        />
      </main>

      <footer className={styles.footer}>
        <p>Ratings pulled from public chess.com and Lichess profiles.</p>
        <p className={styles.footerMeta}>Daily snapshot · 09:00 UTC</p>
      </footer>

      {selectedScorecard ? (
        <PlayerDialog
          key={`${view.platform}-${view.category}-${selectedScorecard.playerId}`}
          scorecard={selectedScorecard}
          model={model}
          playerCount={players.length}
          onClose={closeDialog}
          onFocus={focusFromScorecard}
        />
      ) : null}
    </div>
  );
}
