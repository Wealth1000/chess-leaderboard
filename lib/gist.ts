import { decodeSnapshotDocument } from "@/lib/snapshot-format";
import type { Snapshot } from "@/lib/types";

export const GIST_ID = "cad49ad4e311a1b23628e8a622a40386";
export const GIST_URL = `https://gist.githubusercontent.com/Wealth1000/${GIST_ID}/raw/snapshots.json`;

export async function fetchSnapshots(signal?: AbortSignal): Promise<Snapshot[]> {
  // `cache: "default"` (not "no-store"): the gist raw endpoint sends
  // `cache-control: max-age=300` and the file is rewritten once a day, so letting
  // the HTTP cache serve a reload within a few minutes is free, while any load
  // after the daily update still sees fresh data once the 5 minutes elapse.
  const response = await fetch(GIST_URL, { cache: "default", signal });

  if (!response.ok) {
    throw new Error(`Snapshot request failed with status ${response.status}.`);
  }

  // The storage boundary owns version detection and shape upgrade: v1, v2, and
  // mixed documents all arrive here and malformed input degrades to `[]`.
  return decodeSnapshotDocument(await response.json());
}
