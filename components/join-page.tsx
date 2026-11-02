"use client";

import { useForm, ValidationError } from "@formspree/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "@/lib/types";
import {
  DUPLICATE_MESSAGE,
  resolveHandle,
  validateSubmission,
  type SubmissionChecks,
  type SubmissionError,
} from "@/lib/join";
import { normalizePlayerId } from "@/lib/identity";
import { platformLabel } from "@/lib/format";
import styles from "./join.module.css";

type JoinPageProps = {
  players: Player[];
};

type JoinFormProps = {
  players: Player[];
  formId: string;
};

const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_JOIN_ID;

type Status = "idle" | "verifying" | "sent";

/**
 * The form id is public configuration, not a secret: it is inlined into the
 * client bundle and visible in the network tab no matter what. It still comes
 * from the build environment so a fork or a preview can point at a different
 * Formspree form without a code change.
 *
 * `useForm` throws on an empty id, so an unconfigured build renders a plain
 * notice instead of mounting the form.
 */
export default function JoinPage({ players }: JoinPageProps) {
  if (!FORMSPREE_ID) return <JoinUnavailable />;
  return <JoinForm players={players} formId={FORMSPREE_ID} />;
}

function JoinUnavailable() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.back} href="../">
          ← The Ladder
        </a>
      </header>
      <main className={styles.main}>
        <section className={styles.card}>
          <p className="eyebrow">Join</p>
          <h1 className={styles.title}>Join the ladder</h1>
          <p className={styles.lead}>
            The join form is not available on this build. DM ME (Wealth in the
            group) and I&apos;ll add you.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="../">
              Back to the leaderboard
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function JoinForm({ players, formId }: JoinFormProps) {
  const [formState, formspreeSubmit] = useForm(formId);
  const [whatsappTag, setWhatsappTag] = useState("");
  const [name, setName] = useState("");
  const [chessCom, setChessCom] = useState("");
  const [lichess, setLichess] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<SubmissionError[]>([]);
  const [checks, setChecks] = useState<SubmissionChecks>({
    "chess.com": null,
    lichess: null,
  });
  const [lastId, setLastId] = useState<string | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const latestRequest = useRef<{ "chess.com": string; lichess: string }>({
    "chess.com": "",
    lichess: "",
  });

  const id = useMemo(() => normalizePlayerId(whatsappTag), [whatsappTag]);
  const displayName = useMemo(
    () => name.trim() || whatsappTag.trim() || id,
    [name, whatsappTag, id],
  );
  const hasAnyHandle = Boolean(chessCom.trim() || lichess.trim());
  const errorFor = useCallback(
    (field: SubmissionError["field"]) =>
      errors.find((error) => error.field === field)?.message ?? null,
    [errors],
  );
  const setFieldError = useCallback(
    (field: SubmissionError["field"], message: string) => {
      setErrors((current) => [...current.filter((e) => e.field !== field), { field, message }]);
    },
    [],
  );
  const clearFieldError = useCallback((field: SubmissionError["field"]) => {
    setErrors((current) => current.filter((e) => e.field !== field));
  }, []);

  const checkDuplicateTag = useCallback(() => {
    if (!id) {
      clearFieldError("whatsappTag");
      return;
    }
    if (players.some((player) => player.id === id)) {
      setFieldError("whatsappTag", DUPLICATE_MESSAGE);
    } else {
      clearFieldError("whatsappTag");
    }
  }, [clearFieldError, id, players, setFieldError]);

  const verifyHandle = useCallback(
    async (platform: "chess.com" | "lichess", raw: string) => {
      const username = raw.trim();
      const field = platform === "chess.com" ? "chessCom" : "lichess";
      latestRequest.current[platform] = username;

      if (!username) {
        setChecks((current) => ({ ...current, [platform]: null }));
        clearFieldError(field);
        return;
      }

      if (players.some((player) => {
        const existing = platform === "chess.com" ? player.chessCom : player.lichess;
        return typeof existing === "string" && existing.toLowerCase() === username.toLowerCase();
      })) {
        setChecks((current) => ({ ...current, [platform]: null }));
        setFieldError(field, DUPLICATE_MESSAGE);
        return;
      }

      const check = await resolveHandle(platform, username);
      if (latestRequest.current[platform] !== username) return;
      setChecks((current) => ({ ...current, [platform]: check }));

      if (check.status === "missing") {
        setFieldError(field, `No ${platformLabel(platform)} account with that username.`);
      } else if (check.status === "unverified") {
        setFieldError(field, "Couldn't verify that account right now — try again.");
      } else {
        clearFieldError(field);
      }
    },
    [clearFieldError, players, setFieldError],
  );

  const chessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lichessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chessTimer.current) clearTimeout(chessTimer.current);
    chessTimer.current = setTimeout(() => {
      verifyHandle("chess.com", chessCom);
    }, 400);
    return () => {
      if (chessTimer.current) clearTimeout(chessTimer.current);
    };
  }, [chessCom, verifyHandle]);

  useEffect(() => {
    if (lichessTimer.current) clearTimeout(lichessTimer.current);
    lichessTimer.current = setTimeout(() => {
      verifyHandle("lichess", lichess);
    }, 400);
    return () => {
      if (lichessTimer.current) clearTimeout(lichessTimer.current);
    };
  }, [lichess, verifyHandle]);

  useEffect(() => {
    checkDuplicateTag();
  }, [checkDuplicateTag]);

  const confirmation = useMemo(() => {
    const parts: string[] = [];

    if (checks["chess.com"]?.status === "ok") {
      const rating =
        checks["chess.com"].rating == null
          ? ""
          : ` · chess.com rapid ${checks["chess.com"].rating}`;
      parts.push(`Found: ${checks["chess.com"].username}${rating}`);
    }

    if (checks.lichess?.status === "ok") {
      const rating =
        checks.lichess.rating == null ? "" : ` · lichess rapid ${checks.lichess.rating}`;
      parts.push(`Found: ${checks.lichess.username}${rating}`);
    }

    if (!parts.length || !id) return null;

    const shown =
      displayName && displayName.toLowerCase() !== id
        ? `, shown as ${displayName}`
        : "";

    return `${parts.join(" — ")}. You'll be listed as ${id}${shown}.`;
  }, [checks, displayName, id]);

  const readyToSubmit = Boolean(
    id &&
      hasAnyHandle &&
      !errorFor("whatsappTag") &&
      !errorFor("chessCom") &&
      !errorFor("lichess") &&
      !errorFor("form") &&
      ((checks["chess.com"]?.status === "ok" && chessCom.trim()) ||
        (checks.lichess?.status === "ok" && lichess.trim())) &&
      checks["chess.com"]?.status !== "unverified" &&
      checks.lichess?.status !== "unverified",
  );

  const canSubmit = readyToSubmit && status !== "verifying";
  const busy = formState.submitting || status === "verifying";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Read the form before the first await: React clears `currentTarget` once
    // the synchronous part of the handler returns, and the SDK posts FormData.
    const data = new FormData(e.currentTarget);

    // A filled honeypot means a bot: report success and send nothing.
    if (honeypotRef.current?.value) {
      setLastId(id || null);
      setStatus("sent");
      return;
    }

    setErrors([]);
    setStatus("verifying");

    const result = await validateSubmission(
      { whatsappTag, name, chessCom, lichess },
      players,
      resolveHandle,
    );

    if (!result.ok) {
      setErrors(result.errors);
      setStatus("idle");
      return;
    }

    setChecks(result.checks);
    setLastId(result.player.id);

    // Send the verified, canonical values rather than the raw typing.
    data.set("whatsapp_tag", result.player.id);
    data.set("id", result.player.id);
    data.set("name", result.player.name);
    data.set("chess_com", result.player.chessCom ?? "");
    data.set("lichess", result.player.lichess ?? "");
    data.set("raw_tag", whatsappTag.trim());
    data.set("_subject", "Join request");

    setStatus("idle");
    await formspreeSubmit(data);
  };

  if (status === "sent" || formState.succeeded) {
    return (
      <div className={styles.shell}>
        <header className={styles.header}>
          <a className={styles.back} href="../">
            ← The Ladder
          </a>
        </header>
        <main className={styles.main}>
          <section className={styles.card}>
            <p className="eyebrow">Join</p>
            <h1 className={styles.title}>Sent</h1>
            <p className={styles.lead}>
              Your request has been sent. It will appear after review.
            </p>
            {lastId ? (
              <p className={styles.note}>
                Listed as <strong>{lastId}</strong>. To change or remove these
                details, DM ME (Wealth in the group) — the same applies after
                you&apos;re on the board.
              </p>
            ) : null}
            <div className={styles.actions}>
              <a className={styles.primary} href="../">
                Back to the leaderboard
              </a>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.back} href="../">
          ← The Ladder
        </a>
      </header>
      <main className={styles.main}>
        <section className={styles.card}>
          <p className="eyebrow">Join</p>
          <h1 className={styles.title}>Add yourself to the ladder</h1>
          <p className={styles.lead}>
            Add-only. To change your details or remove yourself, DM ME (Wealth in
            the group).
          </p>
          <p className={styles.note}>
            No rating needed — the ladder reads ratings from Chess.com and
            Lichess. New ratings appear after the next daily update, so
            double-check your usernames and give it a day.
          </p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <input
              ref={honeypotRef}
              type="text"
              name="_gotcha"
              className={styles.hp}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className={styles.field}>
              <label className={styles.label} htmlFor="whatsapp-tag">
                WhatsApp tag
              </label>
              <p className={styles.help}>
                The name people <strong>tag you with</strong> in the group chat,
                not your phone number. If you&apos;re <strong>Wealth</strong> in the
                group, type <strong>Wealth</strong>.
              </p>
              <input
                id="whatsapp-tag"
                name="whatsapp_tag"
                className={styles.input}
                value={whatsappTag}
                onChange={(e) => setWhatsappTag(e.target.value)}
                onBlur={checkDuplicateTag}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errorFor("whatsappTag"))}
                aria-describedby={
                  errorFor("whatsappTag") ? "whatsapp-tag-error" : undefined
                }
              />
              {id ? (
                <p className={styles.meta}>Your id will be {id}</p>
              ) : null}
              {errorFor("whatsappTag") ? (
                <p className={styles.error} id="whatsapp-tag-error" role="alert">
                  {errorFor("whatsappTag")}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="display-name">
                Display name
              </label>
              <p className={styles.help}>
                Defaults to your tag. Edit it if you want a different name on the
                board.
              </p>
              <input
                id="display-name"
                name="name"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={whatsappTag.trim() || "Your tag"}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="chesscom">
                Chess.com username
              </label>
              <input
                id="chesscom"
                name="chess_com"
                className={styles.input}
                value={chessCom}
                onChange={(e) => {
                  setChessCom(e.target.value);
                  setChecks((current) => ({ ...current, "chess.com": null }));
                }}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errorFor("chessCom"))}
                aria-describedby={
                  errorFor("chessCom") ? "chesscom-error" : undefined
                }
              />
              {errorFor("chessCom") ? (
                <p className={styles.error} id="chesscom-error" role="alert">
                  {errorFor("chessCom")}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="lichess">
                Lichess username
              </label>
              <input
                id="lichess"
                name="lichess"
                className={styles.input}
                value={lichess}
                onChange={(e) => {
                  setLichess(e.target.value);
                  setChecks((current) => ({ ...current, lichess: null }));
                }}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errorFor("lichess"))}
                aria-describedby={
                  errorFor("lichess") ? "lichess-error" : undefined
                }
              />
              {errorFor("lichess") ? (
                <p className={styles.error} id="lichess-error" role="alert">
                  {errorFor("lichess")}
                </p>
              ) : null}
            </div>

            {errorFor("form") ? (
              <p className={styles.error} role="alert">
                {errorFor("form")}
              </p>
            ) : null}

            {confirmation ? (
              <div className={styles.confirm} role="status" aria-live="polite">
                <p>{confirmation}</p>
              </div>
            ) : null}

            {formState.errors ? (
              <ValidationError
                errors={formState.errors}
                className={styles.error}
                role="alert"
              />
            ) : null}

            <button
              type="submit"
              className={styles.primary}
              disabled={!canSubmit || busy}
            >
              {formState.submitting
                ? "Sending…"
                : status === "verifying"
                  ? "Checking…"
                  : "Send join request"}
            </button>

            <p className={styles.footnote}>
              To edit or remove, DM ME (Wealth in the group). One submission per
              tag; handles can&apos;t be reused.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
