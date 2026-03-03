/**
 * @fileoverview Heuristic paste-splitter for KWT answer lists.
 *
 * Tries a sequence of delimiter strategies in order of reliability.
 * Returns null when the pasted text looks like a single answer so the
 * caller can fall back to the default paste behaviour.
 */

/**
 * Normalises whitespace inside a single answer token.
 * Collapses all runs of whitespace (including newlines from PDF word-wrap)
 * into a single space.
 *
 * @param s - Raw token string.
 * @returns Trimmed, single-spaced string.
 */
function normaliseToken(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

/** One splitting strategy: returns answers or null if the pattern doesn't match. */
type Strategy = (text: string) => string[] | null;

/**
 * Ordered list of delimiter strategies, from most explicit to least.
 * The first strategy that yields 2+ non-empty tokens wins.
 */
const STRATEGIES: Strategy[] = [// ── 1. Semicolons ────────────────────────────────────────────────
    // Most common in teacher-prepared lists; collapses intra-token newlines
    // so "had lost\ncontact with; lost touch" works correctly.
    (text) => {
        if (!text.includes(';')) return null;
        return text
            .split(';')
            .map(normaliseToken)
            .filter(Boolean);
    },

    // ── 2. Pipe characters ───────────────────────────────────────────
    (text) => {
        if (!text.includes('|')) return null;
        return text.split('|').map(normaliseToken).filter(Boolean);
    },

    // ── 3. Numbered list ─────────────────────────────────────────────
    // Matches: "1. answer", "1) answer", "(1) answer", "1: answer"
    // Every non-empty line must start with a number marker.
    (text) => {
        const lines = text.split(/\r?\n/).map(normaliseToken).filter(Boolean);
        if (lines.length < 2) return null;
        const marker = /^(?:\(\d+\)|\d+[.):])\s*/;
        if (!lines.every((l) => marker.test(l))) return null;
        return lines.map((l) => l.replace(marker, '').trim()).filter(Boolean);
    },

    // ── 4. Letter list ───────────────────────────────────────────────
    // Matches: "a) answer", "a. answer", "(a) answer"
    (text) => {
        const lines = text.split(/\r?\n/).map(normaliseToken).filter(Boolean);
        if (lines.length < 2) return null;
        const marker = /^(?:\([a-zA-Z]\)|[a-zA-Z][.):])\s*/;
        if (!lines.every((l) => marker.test(l))) return null;
        return lines.map((l) => l.replace(marker, '').trim()).filter(Boolean);
    },

    // ── 5. Comma-separated — only when each token is multi-word ─────
    // Avoids false positives from answers that naturally contain commas
    // (e.g. "however, he decided"). Only fires when all tokens are ≥ 2 words
    // AND there are no semicolons/pipes (already handled above).
    (text) => {
        if (!text.includes(',') || text.includes('\n')) return null;
        const tokens = text.split(',').map(normaliseToken).filter(Boolean);
        if (tokens.length < 2) return null;
        // Require every token to be a phrase (≥ 2 words) to avoid splitting
        // single answers that happen to contain a comma.
        if (!tokens.every((t) => t.split(/\s+/).length >= 2)) return null;
        return tokens;
    },

    // ── 6. Plain newlines ────────────────────────────────────────────
    // Last resort: two or more non-empty lines → each is a separate answer.
    (text) => {
        const lines = text.split(/\r?\n/).map(normaliseToken).filter(Boolean);
        if (lines.length < 2) return null;
        return lines;
    },];

/**
 * Attempts to detect the delimiter pattern in pasted text and split it into
 * an array of trimmed, non-empty answer strings.
 *
 * Returns `null` when the text looks like a single answer so the caller can
 * allow the default paste behaviour.
 *
 * @param text - Raw pasted string from the clipboard.
 * @returns Array of answers, or null if no multi-answer pattern was detected.
 */
export function smartSplit(text: string): string[] | null {
    for (const strategy of STRATEGIES) {
        const result = strategy(text);
        if (result && result.length > 1) return result;
    }
    return null;
}