import type { Metadata } from "next";
import JoinPage from "@/components/join-page";
import { players } from "@/lib/players";

export const metadata: Metadata = {
  title: "Join the ladder — The Ladder",
  description: "Add yourself to the group's chess leaderboard.",
};

export default function Join() {
  return <JoinPage players={players} />;
}
