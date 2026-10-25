import type { Snapshot, SnapshotFile } from "@/lib/types";

export const GIST_ID = "cad49ad4e311a1b23628e8a622a40386";
export const GIST_URL = `https://gist.githubusercontent.com/Wealth1000/${GIST_ID}/raw/snapshots.json`;

export async function fetchSnapshots(signal?: AbortSignal): Promise<Snapshot[]> {
  const response = await fetch(GIST_URL, { cache: "no-store", signal });

  if (!response.ok) {
    throw new Error(`Snapshot request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as Partial<SnapshotFile>;
  return Array.isArray(data.snapshots) ? data.snapshots : [];
}
