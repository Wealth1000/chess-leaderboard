"use client";

import { useForm, ValidationError } from "@formspree/react";
import { useState } from "react";
import styles from "./suggestion-form.module.css";

const REPO_ISSUES_URL = "https://github.com/Wealth1000/chess-leaderboard/issues/new";

/**
 * A GitHub issue is the fallback, not the default: `issues/new` requires a
 * GitHub account, so a suggestion from someone without one is silently lost at
 * a sign-in page. Formspree accepts it from anyone.
 *
 * The id is public configuration, not a secret — it ships in the bundle either
 * way. It comes from the build environment so a fork or preview can point at a
 * different form. When it is absent, the old issue flow is kept rather than
 * breaking the page.
 */
const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_SUGGEST_ID;

export default function SuggestionForm() {
  if (!FORMSPREE_ID) return <IssueFallback />;
  return <FormspreeForm formId={FORMSPREE_ID} />;
}

function Receipt({ onReset }: { onReset: () => void }) {
  return (
    <div className={styles.receipt} role="status">
      <p className={styles.receiptTitle}>Suggestion sent.</p>
      <p>Thank you — it has been received.</p>
      <button type="button" className={styles.button} onClick={onReset}>
        Send another
      </button>
    </div>
  );
}

function FormspreeForm({ formId }: { formId: string }) {
  const [state, handleSubmit, reset] = useForm(formId);
  const [suggestion, setSuggestion] = useState("");

  const handleReset = () => {
    setSuggestion("");
    reset();
  };

  return state.succeeded ? (
    <Receipt onReset={handleReset} />
  ) : (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor="suggestion">
        Share your suggestion
      </label>
      <textarea
        id="suggestion"
        name="suggestion"
        className={styles.textarea}
        rows={6}
        value={suggestion}
        onChange={(e) => setSuggestion(e.target.value)}
        placeholder="Tell us what you'd like to see..."
      />
      <input type="hidden" name="_subject" value="Site suggestion" />
      <button
        type="submit"
        className={styles.button}
        disabled={state.submitting}
      >
        {state.submitting ? "Sending…" : "Submit suggestion"}
      </button>
      {state.errors ? (
        <ValidationError
          errors={state.errors}
          className={styles.error}
          role="alert"
        />
      ) : null}
      <p className={styles.hint}>
        Submitting sends your suggestion to the group admin. No account needed.
      </p>
    </form>
  );
}

/**
 * Kept for builds without a suggestion form id, so the page still offers a
 * route. Requires a GitHub account; that is why it is no longer the default.
 */
function IssueFallback() {
  const [suggestion, setSuggestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const body = suggestion.trim()
      ? `**Suggestion:**\n\n${suggestion.trim()}\n\n---\nFrom the site suggestions form.`
      : "No suggestion text provided.";

    const params = new URLSearchParams({
      title: "Site suggestion",
      body,
    });

    window.location.href = `${REPO_ISSUES_URL}?${params.toString()}`;
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor="suggestion">
        Share your suggestion
      </label>
      <textarea
        id="suggestion"
        name="suggestion"
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
        Submitting will open a pre-filled GitHub issue.
      </p>
    </form>
  );
}
