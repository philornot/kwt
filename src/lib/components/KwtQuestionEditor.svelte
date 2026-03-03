<script lang="ts">
    /**
     * @fileoverview Reusable KWT question card editor.
     * Used by both /review (post-OCR) and /create/manual.
     */

    import {t} from '$lib/i18n.svelte.js';
    import type {ParsedKWTQuestion} from '$lib/types.js';
    import {WarningCircleIcon, XSquare} from 'phosphor-svelte';
    import {CANONICAL_GAP} from '$lib/constants.js';
    import AnswersBlock from '$lib/components/AnswersBlock.svelte';

    interface Props {
        question: ParsedKWTQuestion;
        index: number;
        onRemove: () => void;
        error: string | null;
        onTouch?: () => void;
    }

    let {question = $bindable(), index, error, onRemove, onTouch}: Props = $props();

    const GAP = '______';

    /**
     * Uppercases and strips non-alpha characters from keyword input.
     *
     * @param e - Native input event.
     */
    function onKeywordInput(e: Event): void {
        const raw = (e.currentTarget as HTMLInputElement).value;
        question.keyword = raw.toUpperCase().replace(/[^A-Z]/g, '');
    }

    /**
     * Normalises the sentence2 textarea value on every keystroke:
     *  - Any run of underscores is replaced with the canonical six-underscore
     *    gap marker `______`.
     *  - Cursor position is preserved so typing feels natural.
     *
     * @param e - Native input event from the sentence2 textarea.
     */
    function onGapInput(e: Event): void {
        const el = e.currentTarget as HTMLTextAreaElement;
        const raw = el.value;
        const cursorBefore = raw.slice(0, el.selectionStart ?? 0);

        const normalised = raw.replace(/_+/g, (match) =>
            match.length === 1 ? CANONICAL_GAP : match.length < 6 ? '' : CANONICAL_GAP,
        );

        if (normalised === raw) {
            question.sentence2WithGap = raw;
            return;
        }

        question.sentence2WithGap = normalised;

        const normBefore = cursorBefore.replace(/_+/g, (match) =>
            match.length === 1 ? CANONICAL_GAP : match.length < 6 ? '' : CANONICAL_GAP,
        );

        requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = normBefore.length;
        });
    }

    /**
     * Inserts the canonical gap placeholder at the cursor position in sentence2.
     *
     * @param el - The textarea DOM element.
     */
    function insertGap(el: HTMLTextAreaElement): void {
        const s = el.selectionStart ?? el.value.length;
        const e = el.selectionEnd ?? el.value.length;
        question.sentence2WithGap = el.value.slice(0, s) + GAP + el.value.slice(e);
        requestAnimationFrame(() => {
            el.focus();
            el.selectionStart = el.selectionEnd = s + GAP.length;
        });
    }

    /** Retrieves the sentence2 textarea by index and delegates to {@link insertGap}. */
    function handleInsertGap(): void {
        const el = document.getElementById(`s2-${index}`);
        if (el instanceof HTMLTextAreaElement) insertGap(el);
    }

    // ── Word range ──────────────────────────────────────────────────────

    /**
     * Formats minWords / maxWords into the single-field display string.
     *
     * Conventions:
     *   0 / 0  → ''     (no limit)
     *   0 / 5  → '5'    (max only)
     *   2 / 5  → '2–5'  (explicit range)
     *   n / n  → 'n'    (min === max → single number)
     *
     * @param min - Minimum word count (0 = no minimum).
     * @param max - Maximum word count (0 = no maximum).
     * @returns Human-readable string for the text input.
     */
    function formatWordRange(min: number, max: number): string {
        if (!max) return '';
        if (!min || min <= 1 || min === max) return String(max);
        return `${min}–${max}`;
    }

    /**
     * Parses the word-range field and writes back to the question object.
     * Accepted formats: '', '5', '2-5', '2–5'. Invalid input is ignored.
     *
     * @param raw - Raw string value from the input element.
     */
    function applyWordRange(raw: string): void {
        const val = raw.trim();
        if (!val) {
            question.minWords = 0;
            question.maxWords = 0;
            return;
        }

        const rangeMatch = val.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (rangeMatch) {
            const lo = parseInt(rangeMatch[1], 10);
            const hi = parseInt(rangeMatch[2], 10);
            if (lo > 0 && hi > 0 && lo <= hi && hi <= 20) {
                question.minWords = lo;
                question.maxWords = hi;
            }
            return;
        }

        const single = parseInt(val, 10);
        if (!isNaN(single) && single > 0 && single <= 20) {
            question.minWords = 0;
            question.maxWords = single;
        }
    }

    let wordRangeValue = $state(formatWordRange(question.minWords, question.maxWords));

    /**
     * Updates the question object on every keystroke.
     *
     * @param e - Native input event.
     */
    function onWordRangeInput(e: Event): void {
        wordRangeValue = (e.currentTarget as HTMLInputElement).value;
        applyWordRange(wordRangeValue);
    }

    /** Normalises the displayed string on blur and fires the touch callback. */
    function onWordRangeBlur(): void {
        wordRangeValue = formatWordRange(question.minWords, question.maxWords);
        onTouch?.();
    }
</script>

<div class="q-card card" class:has-error={error !== null}>
    <div class="q-header">
        <span class="q-num">{t('review.questionNum', {n: index + 1})}</span>
        {#if error}
            <span class="q-err">
                <WarningCircleIcon size={13} weight="bold"/> {error}
            </span>
        {/if}
        <button
                class="btn-danger rm-btn"
                onclick={onRemove}
                aria-label="{t('common.remove')} #{index + 1}"
        >
            <XSquare size={15} weight="bold"/>
        </button>
    </div>

    <label class="field-label" for="s1-{index}">{t('review.sentence1')}</label>
    <textarea
            id="s1-{index}"
            class="text-input"
            rows="2"
            bind:value={question.sentence1}
            placeholder={t('review.sentence1ph')}
            onblur={() => onTouch?.()}
    ></textarea>

    <label class="field-label" for="kw-{index}">{t('review.keyword')}</label>
    <input
            id="kw-{index}"
            class="text-input kw-input"
            type="text"
            value={question.keyword}
            oninput={onKeywordInput}
            placeholder={t('review.keywordph')}
            onblur={() => onTouch?.()}
    />

    <label class="field-label" for="s2-{index}">
        {t('review.sentence2')}
        <span class="gap-hint">— wpisz <code>_</code> żeby wstawić lukę</span>
    </label>
    <div class="s2-wrap">
        <textarea
                id="s2-{index}"
                class="text-input gap-textarea"
                rows="2"
                value={question.sentence2WithGap}
                oninput={onGapInput}
                placeholder={t('review.sentence2ph')}
                onblur={() => onTouch?.()}
        ></textarea>
        <button
                type="button"
                class="btn-ghost insert-gap-btn"
                class:hidden={question.sentence2WithGap.includes(CANONICAL_GAP)}
                onclick={handleInsertGap}
                title="Wstaw ______ w miejscu kursora"
        >+ ______
        </button>
    </div>

    <div class="bottom-row">
        <div class="answer-field">
            <label class="field-label" for="ans-{index}">{t('review.answer')}</label>
            <input
                    id="ans-{index}"
                    class="text-input"
                    type="text"
                    bind:value={question.correctAnswer}
                    placeholder={t('review.answerph')}
                    onblur={() => onTouch?.()}
            />
        </div>

        <div class="word-range-field">
            <label class="field-label" for="wr-{index}">{t('review.wordRange')}</label>
            <input
                    id="wr-{index}"
                    class="text-input word-range-input"
                    type="text"
                    value={wordRangeValue}
                    oninput={onWordRangeInput}
                    onblur={onWordRangeBlur}
                    placeholder="np. 2–5"
                    title="Wpisz zakres (np. 2–5), samą max. liczbę (np. 5) lub zostaw puste — bez limitu"
            />
            <span class="range-hint">puste = bez limitu</span>
        </div>
    </div>

    <AnswersBlock
            bind:answers={question.alternativeAnswers}
            label={t('review.alternativeAnswers')}
            variant="alt"
            addPlaceholder={t('review.altAnswerPh')}
            chipVariant="ok"
            {onTouch}
    />

    <AnswersBlock
            bind:answers={question.exampleWrongAnswers}
            label={t('review.exampleWrongAnswers')}
            variant="wrong"
            addPlaceholder={t('review.wrongAnswerPh')}
            chipVariant="err"
            {onTouch}
    />
</div>

<style>
    .q-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        border: 2px solid transparent;
        transition: border-color var(--transition-base);
    }

    .q-card.has-error {
        border-color: var(--color-warning);
    }

    .q-header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
    }

    .q-num {
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        font-size: var(--font-size-sm);
    }

    .q-err {
        flex: 1;
        display: flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--color-warning);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
    }

    .rm-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-1) var(--space-2);
        font-size: var(--font-size-xs);
        margin-left: auto;
    }

    .kw-input {
        font-weight: var(--font-weight-bold);
        letter-spacing: var(--letter-spacing-wide);
        max-width: 200px;
        resize: none;
    }

    .gap-hint {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-normal);
        color: var(--color-text-muted);
        text-transform: none;
        letter-spacing: 0;
        margin-left: var(--space-2);
    }

    .gap-hint code {
        font-family: var(--font-mono), monospace;
        background: var(--color-neutral-200);
        padding: 0 3px;
        border-radius: 3px;
    }

    .gap-textarea {
        font-family: var(--font-mono), monospace;
        letter-spacing: -0.03em;
    }

    .s2-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .insert-gap-btn {
        align-self: flex-start;
        padding: var(--space-1) var(--space-3);
        font-size: var(--font-size-xs);
        font-family: var(--font-mono), monospace;
        font-weight: var(--font-weight-bold);
    }

    .insert-gap-btn.hidden {
        visibility: hidden;
        pointer-events: none;
    }

    /* ── Bottom row: correct answer + word range ─────────────────────── */
    .bottom-row {
        display: flex;
        gap: var(--space-4);
        align-items: flex-start; /* top-align so labels line up */
        flex-wrap: wrap;
    }

    .answer-field {
        flex: 1;
        min-width: 200px;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .word-range-field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        flex-shrink: 0;
    }

    .word-range-input {
        width: 96px;
        text-align: left;
    }

    .range-hint {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
    }
</style>