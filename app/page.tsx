import Leaderboard from "@/components/leaderboard";
import { players } from "@/lib/players";

export default function Home() {
  return <Leaderboard players={players} />;
}
