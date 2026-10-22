"use client";

import { PLATFORMS, platformLabel } from "@/lib/format";
import type { Platform } from "@/lib/types";
import styles from "./platform-switch.module.css";

type PlatformSwitchProps = {
  value: Platform;
  onChange: (platform: Platform) => void;
};

export default function PlatformSwitch({
  value,
  onChange,
}: PlatformSwitchProps) {
  return (
    <div className={styles.wrap}>
      <span className={styles.label} aria-hidden="true">
        Ratings
      </span>
      <div className={styles.switch} role="group" aria-label="Rating platform">
        {PLATFORMS.map((platform) => (
          <button
            type="button"
            className={styles.option}
            aria-pressed={platform === value}
            key={platform}
            onClick={() => onChange(platform)}
          >
            {platformLabel(platform)}
          </button>
        ))}
      </div>
    </div>
  );
}
