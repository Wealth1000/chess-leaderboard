"use client";

import { useEffect, useState } from "react";
import { fetchSnapshots } from "@/lib/gist";
import type { Snapshot, SnapshotStatus } from "@/lib/types";

export function useSnapshots() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState<SnapshotStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    fetchSnapshots(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSnapshots(data);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load snapshots:", error);
        setStatus("warning");
      });

    return () => controller.abort();
  }, []);

  return { snapshots, status };
}
