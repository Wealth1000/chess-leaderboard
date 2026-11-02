"use client";

import SuggestionForm from "./suggestion-form";
import styles from "./join.module.css";

export default function SuggestPage() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.back} href="../">
          ← The Ladder
        </a>
      </header>
      <main className={styles.main}>
        <section className={styles.card}>
          <p className="eyebrow">Feedback</p>
          <h1 className={styles.title}>Suggestions</h1>
          <p className={styles.lead}>
            Tell us what would make the ladder better. No GitHub account or
            email address needed.
          </p>
          <SuggestionForm />
        </section>
      </main>
    </div>
  );
}
