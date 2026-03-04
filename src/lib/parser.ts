/**
 * @fileoverview KWT-tuned heuristic parser for OCR output and pasted plain text.
 *
 * Exports a single public entry point `parseQuestions(rawText, type)` that
 * dispatches to the correct internal parser based on exercise type:
 *
 *   'kwt'         → `parseKwtBlock`  — expects a standalone keyword line
 *                                      between sentence1 and sentence2.
 *   'grammar'
 *   'translation' → `parseGapBlock`  — each numbered block is a single gapped
 *                                      sentence; no sentence1 or keyword.
 *
 * Both parsers share the same block-splitting and OCR post-processing logic.
 * This module contains no Node.js imports and is safe to use in browser context.
 */

import type {ParsedKWTQuestion} from './types.js';
import type {ExerciseType} from './constants.js';
import {CANONICAL_GAP} from './constants.js';

// ---------------------------------------------------------------------------
// Shared regexes
// ---------------------------------------------------------------------------

/**
 * Matches numbered exercise starts in both formats:
 *   "1. text"   — simple
 *   "9.1. text" — compound matura-style
 */
const QUESTION_START_RE = /^\s*(\d+(?:[.]\d+)*[.)]\s?)\s*(.*)/;

/**
 * A standalone keyword line: a single word, 2–20 letters, ALL-CAPS or
 * title-cased. OCR sometimes down-cases the keyword, so we accept any-case
 * single word here and uppercase it later.
 */
const KEYWORD_RE = /^[A-Za-z]{2,20}$/;

/**
 * Visual gap representations produced by scanners / Tesseract or pasted
 * from PDF/Word documents:
 *  - 3+ underscores   (most common)
 *  - repeated em/en dashes
 *  - 4+ regular hyphens (Tesseract artefact)
 *  - 5+ dots
 */
const GAP_RE = /_{3,}|—{2,}|-{4,}|\.{5,}/g;

/**
 * Lines that consist almost entirely of short tokens typical of OCR noise
 * from rotated sidebar labels (e.g. "Matura rozszerzona: Gramatykalizacja").
 * Heuristic: line with ≤ 4 words where every word is ≤ 4 characters OR the
 * line matches a known sidebar pattern.
 */
const SIDEBAR_NOISE_RE = /^(?:[A-ZŁŚŻŹ][a-złśżź]{0,3}\s*){1,5}$|Matura|rozszerzona|rozszerzony|podstawowa|podstawowy/i;

// ---------------------------------------------------------------------------
// OCR post-processing
// ---------------------------------------------------------------------------

/** Common single-character substitution errors produced by Tesseract. */
const CHAR_FIXES: Array<[RegExp, string]> = [[/(?<!\w)\|(?!\w)/g, 'I'], // Tesseract sometimes renders underscores as hyphens when the line is short
    [/^[-]{4,}$/, CANONICAL_GAP],];

/**
 * Cleans up common Tesseract character-recognition errors in raw OCR text.
 *
 * @param text - Raw string from Tesseract or pdf-parse.
 * @returns Cleaned string with known substitution errors corrected.
 */
function fixOcrArtefacts(text: string): string {
    let result = text;
    for (const [pattern, replacement] of CHAR_FIXES) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses raw OCR text or pasted plain text into exercise question drafts.
 *
 * Dispatches to the appropriate internal parser based on `type`:
 *  - 'kwt'                     → {@link parseKwtBlock}
 *  - 'grammar' | 'translation' → {@link parseGapBlock}
 *
 * Safe to call in browser context (no Node.js APIs used).
 *
 * @param rawText - Plain text string from Tesseract, pdf-parse, or clipboard.
 * @param type - Exercise type that controls which parser is used.
 * @returns Array of partially-filled {@link ParsedKWTQuestion} objects.
 */
export function parseQuestions(rawText: string, type: ExerciseType = 'kwt',): ParsedKWTQuestion[] {
    const cleaned = fixOcrArtefacts(rawText);
    const lines = cleaned
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .filter((l) => !isSidebarNoise(l));

    const blocks = splitIntoBlocks(lines);
    const parseBlock = type === 'kwt' ? parseKwtBlock : parseGapBlock;

    return blocks
        .map(parseBlock)
        .filter((q) => q.sentence2WithGap.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Noise filtering
// ---------------------------------------------------------------------------

/**
 * Returns true when a line is likely OCR noise from a rotated sidebar label
 * rather than exercise content.
 *
 * Heuristics applied (any match → noise):
 *  1. Known sidebar keywords (Matura, rozszerzona, etc.)
 *  2. Line is ≤ 5 tokens and every token is ≤ 3 characters — typical of
 *     Tesseract breaking up vertical text into single letters / short chunks.
 *
 * @param line - Trimmed, non-empty line from the OCR output.
 * @returns True when the line should be discarded.
 */
function isSidebarNoise(line: string): boolean {
    if (SIDEBAR_NOISE_RE.test(line)) return true;
    const tokens = line.split(/\s+/);
    if (tokens.length <= 5 && tokens.every((tok) => tok.length <= 3)) return true;
    return false;
}

// ---------------------------------------------------------------------------
// Block splitting (shared)
// ---------------------------------------------------------------------------

/**
 * Groups lines into per-question blocks delimited by numbered question starts.
 *
 * @param lines - Trimmed, non-empty lines from the source text.
 * @returns Array of line groups, one per question.
 */
function splitIntoBlocks(lines: string[]): string[][] {
    const blocks: string[][] = [];
    let current: string[] = [];

    for (const line of lines) {
        if (QUESTION_START_RE.test(line)) {
            if (current.length) blocks.push(current);
            current = [line];
        } else if (current.length) {
            current.push(line);
        }
    }
    if (current.length) blocks.push(current);
    return blocks;
}

// ---------------------------------------------------------------------------
// KWT parser
// ---------------------------------------------------------------------------

/**
 * Converts one block of lines into a KWT {@link ParsedKWTQuestion}.
 *
 * Strategy:
 *  - Find the first line that looks like a standalone keyword (KEYWORD_RE).
 *  - Lines before it → sentence1 (joined with spaces).
 *  - Lines after it  → sentence2 (joined with spaces).
 *  - Normalise any gap marker in sentence2 to `______`.
 *  - If no gap is found, insert a fallback gap.
 *
 * @param block - Lines belonging to one numbered question.
 * @returns Parsed KWT question draft.
 */
function parseKwtBlock(block: string[]): ParsedKWTQuestion {
    const firstMatch = block[0].match(QUESTION_START_RE);
    const afterNumber = firstMatch ? firstMatch[2].trim() : block[0];
    const allLines = [afterNumber, ...block.slice(1)].filter((l) => l.length > 0);

    const kwIdx = allLines.findIndex((l) => KEYWORD_RE.test(l));

    let keyword = '';
    let s1Lines: string[];
    let s2Lines: string[];

    if (kwIdx === -1) {
        keyword = '';
        s1Lines = allLines;
        s2Lines = [];
    } else {
        keyword = allLines[kwIdx].toUpperCase();
        s1Lines = allLines.slice(0, kwIdx);
        s2Lines = allLines.slice(kwIdx + 1);
    }

    const sentence1 = s1Lines.join(' ').trim();
    const rawS2 = s2Lines.join(' ').trim();
    const sentence2WithGap = normaliseGap(rawS2);

    return {
        sentence1,
        sentence2WithGap,
        keyword,
        correctAnswer: null,
        alternativeAnswers: [],
        exampleWrongAnswers: [],
        minWords: 0,
        maxWords: 0,
    };
}

// ---------------------------------------------------------------------------
// Gap parser (grammar / translation)
// ---------------------------------------------------------------------------

/**
 * Converts one block of lines into a grammar/translation {@link ParsedKWTQuestion}.
 *
 * The matura grammar format typically has TWO printed gap lines per exercise:
 *
 *   9.2. He got soaked in the rain. He should (take / umbrella) ______
 *   ______ before he set off.
 *
 * Both underline lines belong to a single fill-in answer. After joining lines
 * we collapse any run of multiple consecutive `______` markers into one so the
 * editor shows a single gap input.
 *
 * sentence1 and keyword are left empty — the hint lives inside the sentence
 * as a parenthesised segment, e.g. `(take / umbrella)` or `(z pewnością)`.
 *
 * @param block - Lines belonging to one numbered question.
 * @returns Parsed gap question draft.
 */
function parseGapBlock(block: string[]): ParsedKWTQuestion {
    const firstMatch = block[0].match(QUESTION_START_RE);
    const afterNumber = firstMatch ? firstMatch[2].trim() : block[0];
    const allLines = [afterNumber, ...block.slice(1)].filter((l) => l.length > 0);

    // Separate pure-gap lines (entire line is a gap marker) from content lines.
    // Pure-gap lines are continuations of the same answer blank and should not
    // generate a second `______` in the output.
    const contentLines: string[] = [];
    let trailingGapLine: string | null = null;

    for (const line of allLines) {
        const normalised = line.replace(GAP_RE, CANONICAL_GAP).trim();
        // A pure-gap line is one that, after normalisation, is only `______`
        // (possibly with leading/trailing spaces). These represent the second
        // printed underline of a two-line answer blank.
        if (normalised === CANONICAL_GAP) {
            trailingGapLine = normalised;
        } else {
            contentLines.push(line);
        }
    }

    let rawS2 = contentLines.join(' ').trim();

    // If the sentence already contains a gap marker, the trailing gap line is
    // a continuation blank — discard it (one gap is enough).
    // If there is NO gap in the content yet, append the trailing gap line so
    // the sentence ends with `______`.
    if (trailingGapLine && !GAP_RE.test(rawS2)) {
        rawS2 = rawS2 + ' ' + trailingGapLine;
    }

    // Reset lastIndex after the stateful regex test above.
    GAP_RE.lastIndex = 0;

    const sentence2WithGap = normaliseGap(rawS2);

    // Collapse consecutive gap markers into one:
    // "______ ______" → "______"
    const collapsed = sentence2WithGap.replace(new RegExp(`(${CANONICAL_GAP})(\\s*){2,}`, 'g'), CANONICAL_GAP,);

    return {
        sentence1: '', // Ensure there is a space between the gap marker and the following word.
        sentence2WithGap: collapsed.replace(/(______)([^ ])/g, '$1 $2'),
        keyword: '',
        correctAnswer: null,
        alternativeAnswers: [],
        exampleWrongAnswers: [],
        minWords: 0,
        maxWords: 0,
    };
}

// ---------------------------------------------------------------------------
// Shared gap helpers
// ---------------------------------------------------------------------------

/**
 * Normalises gap markers in a sentence string to the canonical `______` form.
 * If no gap marker is found, inserts a fallback gap at a heuristic position.
 *
 * @param raw - Raw sentence string, possibly containing OCR gap artefacts.
 * @returns Sentence with canonical `______` gap(s).
 */
function normaliseGap(raw: string): string {
    // Reset stateful regex before use.
    GAP_RE.lastIndex = 0;
    if (!raw) return '';
    if (GAP_RE.test(raw)) {
        GAP_RE.lastIndex = 0;
        return raw.replace(GAP_RE, CANONICAL_GAP).trim();
    }
    return insertFallbackGap(raw);
}

/**
 * Inserts a canonical gap into a sentence string that contains no gap marker.
 *
 * Heuristic: split at the first sentence-internal dash or comma; fall back
 * to inserting after the first 3–4 words.
 *
 * @param s - Raw sentence string with no gap marker.
 * @returns Sentence string with `______` inserted.
 */
function insertFallbackGap(s: string): string {
    const dashMatch = s.match(/^(.+?[,–—])\s+(.+)$/);
    if (dashMatch) {
        return `${dashMatch[1].trim()} ${CANONICAL_GAP} ${dashMatch[2].trim()}`.trim();
    }

    const words = s.split(/\s+/);
    const pivot = Math.min(4, Math.max(1, Math.floor(words.length / 2)));
    return [words.slice(0, pivot).join(' '), CANONICAL_GAP, words.slice(pivot).join(' ')]
        .filter(Boolean)
        .join(' ');
}