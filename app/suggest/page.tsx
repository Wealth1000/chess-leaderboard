import type { Metadata } from "next";
import SuggestPage from "@/components/suggest-page";

export const metadata: Metadata = {
  title: "Suggestions — The Ladder",
  description: "Send a suggestion for the group chess leaderboard. No account needed.",
};

export default function Page() {
  return <SuggestPage />;
}
