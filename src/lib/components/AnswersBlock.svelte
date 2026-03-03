<script lang="ts">
    /**
     * @fileoverview Reusable answer chip block used inside KwtQuestionEditor.
     *
     * Renders a labelled section with:
     *   - a list of removable answer chips
     *   - a single-input row for adding answers one by one
     *
     * Bulk import is handled transparently: when the user pastes text the
     * input is analysed by {@link smartSplit}. If a multi-answer pattern is
     * detected (semicolons, pipes, numbered lists, plain newlines, …) all
     * answers are added as chips at once. Single-answer pastes fall through
     * to the normal input behaviour.
     */

    import {PlusIcon, XSquare} from 'phosphor-svelte';
    import {smartSplit} from '$lib/smartSplit.js';

    interface Props {
        /** The answer array to display and mutate (bound by reference). */
        answers: string[];
        /** Section label shown above the chips. */
        label: string;
        /** Identifies this block ('alt' | 'wrong'). */
        variant: 'alt' | 'wrong';
        /** Placeholder text for the single-add input. */
        addPlaceholder: string;
        /** Colour theme for chips: 'ok' = green, 'err' = red. */
        chipVariant: 'ok' | 'err';
        /** Called whenever the answers array is mutated. */
        onTouch?: () => void;
    }

    let {
        answers = $bindable(),
        label,
        variant,
        addPlaceholder,
        chipVariant,
        onTouch,
    }: Props = $props();

    let newAnswer = $state('');

    /** Appends a trimmed non-empty string to the answers array. */
    function addAnswer(): void {
        const val = newAnswer.trim();
        if (!val) return;
        answers.push(val);
        newAnswer = '';
        onTouch?.();
    }

    /**
     * Adds an answer when Enter is pressed in the single-add input.
     *
     * @param e - Keyboard event.
     */
    function onKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter') {
            e.preventDefault();
            addAnswer();
        }
    }

    /**
     * Intercepts paste events. When {@link smartSplit} detects a multi-answer
     * pattern the event is cancelled and all answers are added as chips at
     * once. Single-answer pastes are passed through unchanged.
     *
     * @param e - ClipboardEvent from the input element.
     */
    function onPaste(e: ClipboardEvent): void {
        const text = e.clipboardData?.getData('text') ?? '';
        const parts = smartSplit(text);
        if (!parts) return; // single answer — let the browser handle it

        e.preventDefault();
        answers.push(...parts);
        newAnswer = '';
        onTouch?.();
    }
</script>

<div class="answers-block">
    <span class="field-label">{label}</span>

    {#if answers.length > 0}
        <div class="chip-list">
            {#each answers as ans, i}
                <span class="chip" class:chip-ok={chipVariant === 'ok'} class:chip-err={chipVariant === 'err'}>
                    {ans}
                    <button
                            class="chip-rm"
                            type="button"
                            aria-label="Usuń {ans}"
                            onclick={() => { answers.splice(i, 1); onTouch?.(); }}
                    >
                        <XSquare size={11} weight="bold"/>
                    </button>
                </span>
            {/each}
        </div>
    {/if}

    <div class="add-row">
        <input
                class="text-input add-input"
                type="text"
                bind:value={newAnswer}
                placeholder={addPlaceholder}
                onkeydown={onKeydown}
                onpaste={onPaste}
                onblur={() => onTouch?.()}
        />
        <button type="button" class="btn-ghost add-chip-btn" onclick={addAnswer}>
            <PlusIcon size={13} weight="bold"/>
            Dodaj
        </button>
    </div>
</div>

<style>
    .answers-block {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--color-neutral-100);
        border-radius: var(--radius-md);
    }

    .chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
    }

    .chip-ok {
        background: var(--color-success-light);
        color: var(--color-success-dark);
    }

    .chip-err {
        background: var(--color-danger-light);
        color: var(--color-danger-dark);
    }

    .chip-rm {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: inherit;
        opacity: 0.7;
        border-radius: 0;
    }

    .chip-rm:hover {
        opacity: 1;
    }

    .chip-rm:active {
        transform: none;
    }

    .add-row {
        display: flex;
        gap: var(--space-2);
        align-items: center;
    }

    .add-input {
        flex: 1;
        font-size: var(--font-size-sm);
        padding: var(--space-1) var(--space-2);
    }

    .add-chip-btn {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-3);
        font-size: var(--font-size-xs);
        white-space: nowrap;
        flex-shrink: 0;
    }
</style>