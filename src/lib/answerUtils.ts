/**
 * @fileoverview Shared utilities for KWT answer normalisation and comparison.
 *
 * Used by both the submit endpoint (grading) and the result page loader
 * (computing sibling variants for display).
 */

/**
 * Maps contracted English forms to their expanded equivalents.
 */
const CONTRACTIONS: Record<string, string> = {
    "aren't": 'are not',
    "can't": 'cannot',
    "couldn't": 'could not',
    "didn't": 'did not',
    "doesn't": 'does not',
    "don't": 'do not',
    "hadn't": 'had not',
    "hasn't": 'has not',
    "haven't": 'have not',
    "he'd": 'he would',
    "he'll": 'he will',
    "he's": 'he is',
    "i'd": 'i would',
    "i'll": 'i will',
    "i'm": 'i am',
    "i've": 'i have',
    "isn't": 'is not',
    "it's": 'it is',
    "mustn't": 'must not',
    "needn't": 'need not',
    "shan't": 'shall not',
    "she'd": 'she would',
    "she'll": 'she will',
    "she's": 'she is',
    "shouldn't": 'should not',
    "that's": 'that is',
    "there's": 'there is',
    "they'd": 'they would',
    "they'll": 'they will',
    "they're": 'they are',
    "they've": 'they have',
    "wasn't": 'was not',
    "we'd": 'we would',
    "we're": 'we are',
    "we've": 'we have',
    "weren't": 'were not',
    "what's": 'what is',
    "who's": 'who is',
    "won't": 'will not',
    "wouldn't": 'would not',
    "you'd": 'you would',
    "you'll": 'you will',
    "you're": 'you are',
    "you've": 'you have',
};

/**
 * Normalises a raw answer string for comparison.
 * Lowercases, expands contractions, trims, and collapses whitespace.
 *
 * @param s - Raw answer string.
 * @returns Normalised string ready for equality comparison.
 */
export function normalise(s: string): string {
    return s
        .toLowerCase()
        .replace(/[\w']+/g, (w) => CONTRACTIONS[w] ?? w)
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * Expands an answer that contains parenthesised optional segments into all
 * valid surface-form variants (not yet normalised).
 *
 * Each `(…)` group is treated as optional — it may be included or omitted.
 * The function returns the Cartesian product of all such choices.
 *
 * Examples:
 *   "so noisy outside (that)"  → ["so noisy outside", "so noisy outside that"]
 *   "(very) noisy outside"     → ["noisy outside", "very noisy outside"]
 *   "so (very) noisy (that)"   → 4 variants
 *   "had not been"             → ["had not been"]
 *
 * @param raw - A single answer string, possibly containing `(…)` groups.
 * @returns Array of surface-form variant strings (whitespace collapsed, trimmed).
 */
export function expandOptionals(raw: string): string[] {
    const groups: Array<{ start: number; end: number; inner: string }> = [];
    const re = /\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        groups.push({start: m.index, end: m.index + m[0].length, inner: m[1]});
    }

    if (groups.length === 0) return [raw.replace(/\s+/g, ' ').trim()];

    const variants = new Set<string>();
    const count = 2 ** groups.length;

    for (let mask = 0; mask < count; mask++) {
        let result = '';
        let cursor = 0;
        for (let gi = 0; gi < groups.length; gi++) {
            const g = groups[gi];
            result += raw.slice(cursor, g.start);
            if (mask & (1 << gi)) result += g.inner;
            cursor = g.end;
        }
        result += raw.slice(cursor);
        const clean = result.replace(/\s+/g, ' ').trim();
        if (clean) variants.add(clean);
    }

    return Array.from(variants);
}

/**
 * Represents one stored answer string together with all its surface variants
 * and their normalised forms.
 */
export interface AnswerFamily {
    /** The raw string as stored in the DB (may contain parentheses). */
    raw: string;
    /** All surface variants (with/without optional parts), not normalised. */
    variants: string[];
    /** `variants` after normalisation — used for lookup. */
    normalisedVariants: string[];
}

/**
 * Builds a family entry for a single stored answer string.
 *
 * @param raw - Raw answer string from the database.
 * @returns {@link AnswerFamily} with all variants pre-computed.
 */
export function buildFamily(raw: string): AnswerFamily {
    const variants = expandOptionals(raw);
    return {raw, variants, normalisedVariants: variants.map(normalise)};
}

/**
 * Builds the full set of normalised accepted answers for a question,
 * expanding any parenthesised optional segments in every stored answer.
 *
 * @param correctAnswer - The primary correct answer string.
 * @param alternativeAnswers - Additional accepted answer strings.
 * @returns Deduplicated array of normalised strings ready for comparison.
 */
export function buildAcceptedSet(correctAnswer: string, alternativeAnswers: string[],): string[] {
    const all = [correctAnswer, ...alternativeAnswers];
    const expanded = all.flatMap((a) => expandOptionals(a).map(normalise));
    return [...new Set(expanded)];
}

/**
 * Given what the user typed and the stored answer strings, returns the
 * "sibling" surface forms — the other variants of the same parenthesised
 * answer that the user's response matched.
 *
 * For example, if the correct answer is `"so noisy outside (that)"` and
 * the user typed `"so noisy outside"`, the sibling is `"so noisy outside that"`.
 *
 * @param given - The raw string the user submitted.
 * @param correctAnswer - Primary correct answer from the DB.
 * @param alternativeAnswers - Alternative accepted answers from the DB.
 * @returns Array of sibling surface-form strings (excluding what the user typed),
 *          or an empty array if there are no optional variants.
 */
export function computeSiblings(given: string, correctAnswer: string, alternativeAnswers: string[],): string[] {
    const normGiven = normalise(given);
    const families = [correctAnswer, ...alternativeAnswers].map(buildFamily);

    for (const family of families) {
        const idx = family.normalisedVariants.indexOf(normGiven);
        if (idx === -1) continue;

        // Found the family — return the other variants (preserve surface form).
        return family.variants.filter((_, i) => i !== idx);
    }

    return [];
}