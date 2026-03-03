<script lang="ts">
    import {t} from '$lib/i18n.svelte.js';
    import type {PageData} from './$types.js';
    import type {SetSummary} from '$lib/types.js';
    import {ArrowRightIcon, CameraIcon, LinkIcon, MagnifyingGlassIcon, PencilSimpleIcon, RocketLaunchIcon, UploadIcon} from 'phosphor-svelte';

    let {data} = $props<{ data: PageData }>();

    const sets = $derived(data.sets as SetSummary[]);

    /** Slug of the set whose link was just copied — used to show feedback. */
    let copiedSlug = $state<string | null>(null);

    /**
     * Copies the shareable URL for a set to the clipboard and briefly
     * shows a confirmation on the button.
     *
     * @param slug - The set's slug.
     */
    async function copyLinkIcon(slug: string) {
        const url = `${window.location.origin}/set/${slug}`;
        await navigator.clipboard.writeText(url);
        copiedSlug = slug;
        setTimeout(() => {
            copiedSlug = null;
        }, 2000);
    }
</script>

<svelte:head>
    <title>Key word transformations</title>
</svelte:head>

<div class="home">

    <!-- ── Compact hero ──────────────────────────────────────────────── -->
    <section class="hero">
        <div class="hero-text">
            <h1 class="hero-title">{t('home.title')}</h1>
            <p class="hero-sub">{t('home.subtitle')}</p>
        </div>
        <div class="cta-row">
            <!-- Manual first (primary), scan second (ghost + beta) -->
            <a href="/create/manual" class="cta-card cta-primary">
                <PencilSimpleIcon size={24} weight="duotone"/>
                <div>
                    <strong>{t('home.manualTitle')}</strong>
                    <span>{t('home.manualDesc')}</span>
                </div>
            </a>
            <a href="/create/scan" class="cta-card cta-ghost">
                <CameraIcon size={24} weight="duotone"/>
                <div>
                    <strong>
                        {t('home.scanTitle')}
                        <span class="beta-pill">BETA</span>
                    </strong>
                    <span>{t('home.scanDesc')}</span>
                </div>
            </a>
        </div>
    </section>

    <!-- ── Sets listing ──────────────────────────────────────────────── -->
    <section class="sets-section">
        <h2 class="section-title">{t('home.setsTitle')}</h2>

        {#if sets.length === 0}
            <div class="no-sets card">
                <p>Nie ma jeszcze żadnych zestawów do rozwiązania.</p>
                <p class="no-sets-sub">Możesz stworzyć własny zestaw i podzielić się nim przez link.</p>
            </div>
        {:else}
            <div class="sets-grid">
                {#each sets as s (s.slug)}
                    <div class="set-card card">
                        {#if s.sourceLabel}
                            <span class="source-badge">{s.sourceLabel}</span>
                        {/if}
                        <strong class="set-title">{s.title}</strong>
                        <span class="set-meta">{t('home.questionsCount', {n: s.questionCount})}</span>
                        <div class="set-actions">
                            <a href="/set/{s.slug}" class="solve-link">
                                {t('home.solveNow')}
                                <ArrowRightIcon size={14} weight="bold"/>
                            </a>
                            <button
                                    class="copy-btn"
                                    onclick={() => copyLinkIcon(s.slug)}
                                    title="Skopiuj link do udostępnienia"
                                    aria-label="Skopiuj link do zestawu {s.title}"
                            >
                                {#if copiedSlug === s.slug}
                                    <span class="copied-label">Skopiowano!</span>
                                {:else}
                                    <LinkIcon size={14} weight="bold"/>
                                {/if}
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </section>

    <!-- ── How it works ──────────────────────────────────────────────── -->
    <section class="how">
        <h2 class="section-title">{t('home.howItWorksTitle')}</h2>
        <div class="steps">
            <div class="step card">
                <div class="step-icon">
                    <UploadIcon size={22} weight="duotone"/>
                </div>
                <div class="step-num">1</div>
                <strong>{t('home.step1')}</strong>
                <p>{t('home.step1desc')}</p>
            </div>
            <div class="step-arrow">→</div>
            <div class="step card">
                <div class="step-icon">
                    <MagnifyingGlassIcon size={22} weight="duotone"/>
                </div>
                <div class="step-num">2</div>
                <strong>{t('home.step2')}</strong>
                <p>{t('home.step2desc')}</p>
            </div>
            <div class="step-arrow">→</div>
            <div class="step card">
                <div class="step-icon">
                    <RocketLaunchIcon size={22} weight="duotone"/>
                </div>
                <div class="step-num">3</div>
                <strong>{t('home.step3')}</strong>
                <p>{t('home.step3desc')}</p>
            </div>
        </div>
    </section>
</div>

<style>
    .home {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
    }

    /* ── Hero ─────────────────────────────────────────────────────────── */
    .hero {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-6) 0 0;
    }

    .hero-title {
        font-size: var(--font-size-4xl);
        font-weight: var(--font-weight-black);
        line-height: var(--line-height-tight);
        letter-spacing: var(--letter-spacing-tight);
    }

    .hero-sub {
        font-size: var(--font-size-base);
        color: var(--color-text-muted);
        max-width: 560px;
        line-height: var(--line-height-base);
        margin-top: var(--space-2);
    }

    .cta-row {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    .cta-card {
        flex: 1;
        min-width: 220px;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        border-radius: var(--radius-xl);
        text-decoration: none;
        transition: transform var(--transition-base), box-shadow var(--transition-base);
    }

    .cta-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
        text-decoration: none;
    }

    .cta-primary {
        background: var(--color-primary);
        color: var(--color-surface);
        box-shadow: var(--shadow-md);
    }

    .cta-ghost {
        background: var(--color-surface);
        color: var(--color-text);
        border: 2px solid var(--color-border);
        box-shadow: var(--shadow-sm);
    }

    .cta-card div {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .cta-primary strong {
        color: var(--color-surface);
        font-size: var(--font-size-sm);
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .cta-primary span {
        color: rgba(255, 255, 255, 0.75);
        font-size: var(--font-size-xs);
    }

    .cta-ghost strong {
        color: var(--color-text);
        font-size: var(--font-size-sm);
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .cta-ghost span {
        color: var(--color-text-muted);
        font-size: var(--font-size-xs);
    }

    .beta-pill {
        background: var(--color-warning);
        color: #fff;
        font-size: 0.6rem;
        font-weight: var(--font-weight-black);
        letter-spacing: var(--letter-spacing-wider);
        padding: 1px 5px;
        border-radius: var(--radius-full);
        line-height: 1.4;
        vertical-align: middle;
    }

    /* ── Section shared ───────────────────────────────────────────────── */
    .section-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-extrabold);
        margin-bottom: var(--space-4);
    }

    /* ── Sets grid ────────────────────────────────────────────────────── */
    .sets-section {
        display: flex;
        flex-direction: column;
    }

    .no-sets {
        text-align: center;
        color: var(--color-text-faint);
        padding: var(--space-8);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .no-sets-sub {
        font-size: var(--font-size-sm);
        color: var(--color-text-faint);
    }

    .sets-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: var(--space-4);
    }

    .set-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        color: var(--color-text);
        transition: transform var(--transition-base), box-shadow var(--transition-base);
        padding: var(--space-5);
    }

    .set-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
    }

    .source-badge {
        display: inline-block;
        align-self: flex-start;
        background: var(--color-primary-muted);
        color: var(--color-primary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        padding: 2px var(--space-2);
        border-radius: var(--radius-full);
        letter-spacing: var(--letter-spacing-wide);
        text-transform: uppercase;
    }

    .set-title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-bold);
        line-height: var(--line-height-snug);
        flex: 1;
    }

    .set-meta {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
    }

    .set-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--space-1);
    }

    .solve-link {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
        text-decoration: none;
    }

    .solve-link:hover {
        text-decoration: underline;
    }

    .copy-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0 var(--space-2);
        background: var(--color-neutral-100);
        color: var(--color-text-muted);
        border: none;
        border-radius: var(--radius-md);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        transition: background var(--transition-base), color var(--transition-base);
    }

    .copy-btn:hover {
        background: var(--color-primary-light);
        color: var(--color-primary);
    }

    .copy-btn:active {
        transform: scale(0.95);
    }

    .copied-label {
        color: var(--color-success-dark);
        white-space: nowrap;
    }

    /* ── How it works ─────────────────────────────────────────────────── */
    .how {
        display: flex;
        flex-direction: column;
    }

    .steps {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    .step {
        flex: 1;
        min-width: 180px;
        max-width: 240px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-2);
        padding: var(--space-5) var(--space-4);
        position: relative;
    }

    .step-icon {
        color: var(--color-primary);
    }

    .step-num {
        position: absolute;
        top: var(--space-3);
        right: var(--space-3);
        background: var(--color-primary-muted);
        color: var(--color-primary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-black);
        width: 20px;
        height: 20px;
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .step strong {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-bold);
    }

    .step p {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        line-height: var(--line-height-snug);
    }

    .step-arrow {
        font-size: var(--font-size-xl);
        color: var(--color-neutral-400);
        flex-shrink: 0;
    }

    @media (max-width: 600px) {
        .hero-title {
            font-size: var(--font-size-2xl);
        }

        .step-arrow {
            display: none;
        }

        .step {
            max-width: 100%;
        }
    }
</style>