"use client";

import { useState } from "react";
import styles from "./closed-site.module.css";

const REPO_ISSUES_URL = "https://github.com/Wealth1000/chess-leaderboard/issues/new";

export default function ClosedSite() {
  const [suggestion, setSuggestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = suggestion.trim()
      ? `**Suggestion:**\n\n${suggestion.trim()}\n\n---\nFrom the site closure form.`
      : "No suggestion text provided.";
    const params = new URLSearchParams({
      title: "Site suggestion",
      body,
    });
    window.open(`${REPO_ISSUES_URL}?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <section className={styles.card}>
          <p className="eyebrow">Under Construction</p>
          <h1 className={styles.title}>The site is under construction</h1>
          <p className={styles.message}>
            Adjustments are being made to reach its full potential and better serve
            the people.
          </p>
          <div className={styles.suggestionsBox}>
            <p className={styles.suggestionsLabel}>Suggestions are welcome!</p>
          </div>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.label} htmlFor="suggestion">
              Share your suggestion
            </label>
            <textarea
              id="suggestion"
              className={styles.textarea}
              rows={6}
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Tell us what you'd like to see..."
            />
            <button type="submit" className={styles.button}>
              Submit suggestion
            </button>
            <p className={styles.hint}>
              Submitting will open a pre-filled GitHub issue in a new tab.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
