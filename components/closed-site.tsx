"use client";

import SuggestionForm from "./suggestion-form";
import styles from "./closed-site.module.css";

export default function ClosedSite() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <section className={styles.card}>
          <p className="eyebrow">Under Construction</p>
          <h1 className={styles.title}>The site is under construction</h1>
          <p className={styles.message}>
            Adjustments are being made to reach its full potential and better
            serve the people.
          </p>
          <div className={styles.suggestionsBox}>
            <p className={styles.suggestionsLabel}>Suggestions are welcome!</p>
          </div>
          <SuggestionForm />
        </section>
      </main>
    </div>
  );
}
