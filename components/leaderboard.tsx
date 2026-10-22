"use client";

import { useCallback, useMemo, useState } from "react";
import { useSnapshots } from "@/hooks/use-snapshots";
import { buildLeaderboard } from "@/lib/leaderboard";
import type { Player, RankedPlayer } from "@/lib/types";
import ClubBoard from "./club-board";
import Hero from "./hero";
import Masthead from "./masthead";
import PlayerDialog from "./player-dialog";
import styles from "./leaderboard.module.css";

type LeaderboardProps = {
  players: Player[];
};

export default function Leaderboard({ players }: LeaderboardProps) {
  const { snapshots, status } = useSnapshots();
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayer | null>(null);

  const { ranked, latestDate, leader } = useMemo(
    () => buildLeaderboard(players, snapshots),
    [players, snapshots],
  );

  const loading = status === "loading";
  const warning = status === "warning";

  const closeDialog = useCallback(() => setSelectedPlayer(null), []);

  return (
    <div className={styles.shell}>
      <Masthead latestDate={latestDate} loading={loading} />

      <main>
        <Hero
          ranked={ranked}
          playerCount={players.length}
          loading={loading}
          warning={warning}
        />
        <ClubBoard
          ranked={ranked}
          loading={loading}
          warning={warning}
          onSelect={setSelectedPlayer}
        />
      </main>

      <footer className={styles.footer}>
        <p>Ratings pulled from public chess.com and Lichess profiles.</p>
        <p className={styles.footerMeta}>Daily snapshot · 09:00 UTC</p>
      </footer>

      {selectedPlayer ? (
        <PlayerDialog
          key={selectedPlayer.id}
          player={selectedPlayer}
          snapshots={snapshots}
          latestDate={latestDate}
          leader={leader}
          playerCount={players.length}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}
