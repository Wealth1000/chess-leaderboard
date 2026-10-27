import ClosedSite from "@/components/closed-site";
import Leaderboard from "@/components/leaderboard";
import { players } from "@/lib/players";

const SITE_CLOSED = process.env.NEXT_PUBLIC_SITE_CLOSED === "true";

export default function Home() {
  if (SITE_CLOSED) {
    return <ClosedSite />;
  }

  return <Leaderboard players={players} />;
}
