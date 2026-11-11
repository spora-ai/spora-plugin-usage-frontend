<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from '../shims'
import type { SeriesWindow, UsagePrincipal, UsageSeries, UsageUnpriced } from '../types'
import { myPrincipalsPath, seriesPath, unpricedPath } from '../lib/usage-api'
import { isForbidden, messageOf } from '../lib/errors'
import { formatCredits, formatTokens } from '../lib/format'
import { useUsageLabels } from '../composables/useUsageLabels'
import { useIsAdmin } from '../composables/useIsAdmin'
import { useUsageStore } from '../stores/usage'
import UsageLimitTable from './UsageLimitTable.vue'
import UsageSpendChart from './UsageSpendChart.vue'

const props = defineProps<{ hostContext: PluginHostContext }>()

const { t, locale } = useI18n()
const labels = useUsageLabels()
const store = useUsageStore()

/**
 * The Overview has two faces.
 *
 * A caller sees their own principals, their balances, their limits and
 * their spend. An admin sees the whole installation as well — what it
 * spent, who spent it, what has no credits and what costs nothing — and
 * that face is built from the admin endpoints alone.
 */
const isAdmin = useIsAdmin(props.hostContext)

const principals = ref<UsagePrincipal[]>([])
const series = ref<UsageSeries | null>(null)
const seriesWindow = ref<SeriesWindow>('day')
const principalsLoading = ref(true)
const seriesLoading = ref(true)
const principalsError = ref<string | null>(null)
const seriesError = ref<string | null>(null)

const unpriced = ref<UsageUnpriced>({
    models: [],
    tools: [],
    not_billed: { models: [], tools: [] },
})
const unpricedLoading = ref(false)
const unpricedError = ref<string | null>(null)

const windows: SeriesWindow[] = ['day', 'week', 'month']

async function loadOwnPrincipals(): Promise<void> {
    principalsLoading.value = true
    principalsError.value = null
    try {
        const response = await props.hostContext.api.get<{ principals: UsagePrincipal[] }>(
            myPrincipalsPath(),
        )
        principals.value = response.principals ?? []
    } catch (e) {
        principalsError.value = messageOf(e)
    } finally {
        principalsLoading.value = false
    }
}

/**
 * The series of the selected window.
 *
 * Switching the window fires the requests in parallel, so an earlier one
 * can land after a later one. The window the request was made for is
 * captured here, and the answer — the series, the error and the loading
 * flag — is applied only while that window is still the selected one.
 * Otherwise the chart would show the window the operator passed over, and
 * a late answer would clear the spinner of a request still in flight.
 */
async function loadSeries(): Promise<void> {
    const requested = seriesWindow.value
    seriesLoading.value = true
    seriesError.value = null
    try {
        const response = await props.hostContext.api.get<UsageSeries>(seriesPath(requested))
        if (requested !== seriesWindow.value) {
            return
        }
        series.value = response
    } catch (e) {
        if (requested !== seriesWindow.value) {
            return
        }
        seriesError.value = messageOf(e)
    } finally {
        if (requested === seriesWindow.value) {
            seriesLoading.value = false
        }
    }
}

/**
 * The models and tools that were used and cost nothing.
 *
 * They are the money leaking right now: every call is free because the
 * book has no row for it.
 */
async function loadUnpriced(): Promise<void> {
    unpricedLoading.value = true
    unpricedError.value = null
    try {
        const response = await props.hostContext.api.get<UsageUnpriced>(unpricedPath())
        unpriced.value = {
            models: response.models ?? [],
            tools: response.tools ?? [],
            not_billed: {
                models: response.not_billed?.models ?? [],
                tools: response.not_billed?.tools ?? [],
            },
        }
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        unpricedError.value = messageOf(e)
    } finally {
        unpricedLoading.value = false
    }
}

/** What the installation spent in the last 30 days. */
const totalSpend30d = computed(() =>
    store.principals.reduce((sum, principal) => sum + principal.spend_30d, 0),
)

/**
 * The principals that spent the most.
 *
 * The list is sorted by the 30-day spend and cut short: an installation
 * with a hundred principals does not become more readable with a hundred
 * rows, and the ones at the top are the ones worth looking at. A
 * principal that spent nothing is not on it — the list is about the
 * money that left the installation.
 */
const topSpenders = computed(() =>
    store.principals
        .filter((principal) => principal.spend_30d > 0)
        .sort((a, b) => b.spend_30d - a.spend_30d)
        .slice(0, 5),
)

/**
 * The principals that have nothing left to spend.
 *
 * A principal without a credit pool and a principal whose pool is empty
 * are both principals that cannot pay for anything.
 */
const emptyPools = computed(() =>
    store.principals.filter(
        (principal) => principal.balance === null || principal.balance === 0,
    ),
)

const installLoading = computed(() => store.principalsLoading || unpricedLoading.value)
const installError = computed(() => store.principalsError ?? unpricedError.value)

/**
 * The calls that had a price and were not charged.
 *
 * The principal ran them with their own configuration, so the
 * installation did not pay for them and did not charge for them either.
 */
const notBilledModels = computed(() => unpriced.value.not_billed?.models ?? [])
const notBilledTools = computed(() => unpriced.value.not_billed?.tools ?? [])

onMounted(async () => {
    await Promise.all([loadOwnPrincipals(), loadSeries()])
})

watch(seriesWindow, () => {
    void loadSeries()
})

/**
 * The install-wide face.
 *
 * The principal listing is the one the store keeps, so the picker and
 * this section share a single read of it. Both are admin-only, and a
 * refusal is the server's answer rather than a failure to show.
 */
watch(
    isAdmin,
    (admin) => {
        if (!admin) {
            return
        }
        void store.loadPrincipals(props.hostContext.api)
        void loadUnpriced()
    },
    { immediate: true },
)
</script>

<template>
    <div class="flex flex-col gap-6" data-testid="usage-panel-overview">
        <header class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ t('Usage') }}</h2>
            <p class="text-sm text-muted-foreground">
                <span v-if="isAdmin">
                    {{ t('Your usage, and the usage of the whole installation.') }}
                </span>
                <span v-else>{{ t('Your balances, your limits and what your spend looks like.') }}</span>
            </p>
        </header>

        <!-- The install-wide face. It is admin-only: a caller who cannot
             configure the installation has no business seeing its
             principals, and the listing would be refused anyway. -->
        <section
            v-if="isAdmin"
            class="flex flex-col gap-4 rounded-xl border border-border p-4"
            data-testid="usage-install"
        >
            <header class="flex flex-col gap-1">
                <h3 class="text-sm font-semibold">{{ t('This installation') }}</h3>
                <p class="text-sm text-muted-foreground">
                    {{ t('Everything on this installation: what it spent, who spent it, and what costs nothing.') }}
                </p>
            </header>

            <div
                v-if="installLoading"
                class="text-sm text-muted-foreground"
                data-testid="usage-install-loading"
            >
                {{ t('Loading usage…') }}
            </div>
            <div
                v-else-if="installError"
                class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                data-testid="usage-install-error"
            >
                {{ t('Failed to load usage: {error}', { error: installError }) }}
            </div>

            <template v-else>
                <div class="flex flex-wrap gap-6">
                    <div class="flex flex-col">
                        <span class="text-xs uppercase tracking-wide text-muted-foreground">
                            {{ t('Total spend (30 days)') }}
                        </span>
                        <span
                            class="text-lg font-semibold"
                            data-testid="usage-install-total-spend"
                        >
                            {{ formatCredits(totalSpend30d, locale) }}
                        </span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs uppercase tracking-wide text-muted-foreground">
                            {{ t('Principals') }}
                        </span>
                        <span
                            class="text-lg font-semibold"
                            data-testid="usage-install-principals"
                        >
                            {{ store.principals.length }}
                        </span>
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('Top spenders') }}
                    </h4>
                    <p
                        v-if="topSpenders.length === 0"
                        class="text-sm text-muted-foreground"
                        data-testid="usage-install-no-spenders"
                    >
                        {{ t('Nothing was spent in the last 30 days.') }}
                    </p>
                    <ul v-else class="flex flex-col gap-1">
                        <li
                            v-for="principal in topSpenders"
                            :key="principal.id"
                            class="flex items-baseline justify-between gap-3 text-sm"
                            :data-testid="`usage-install-spender-${principal.id}`"
                        >
                            <span class="truncate font-medium">{{ principal.name }}</span>
                            <span class="text-muted-foreground">
                                {{ formatCredits(principal.spend_30d, locale) }}
                            </span>
                        </li>
                    </ul>
                </div>

                <div class="flex flex-col gap-2">
                    <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('Empty credit pools') }}
                    </h4>
                    <p
                        v-if="emptyPools.length === 0"
                        class="text-sm text-muted-foreground"
                        data-testid="usage-install-no-empty-pools"
                    >
                        {{ t('Every principal has credits.') }}
                    </p>
                    <ul v-else class="flex flex-col gap-1">
                        <li
                            v-for="principal in emptyPools"
                            :key="principal.id"
                            class="flex items-baseline justify-between gap-3 text-sm"
                            :data-testid="`usage-install-empty-pool-${principal.id}`"
                        >
                            <span class="truncate font-medium">{{ principal.name }}</span>
                            <span class="text-muted-foreground">
                                {{ principal.balance === null
                                    ? t('No credit pool')
                                    : formatCredits(principal.balance, locale) }}
                            </span>
                        </li>
                    </ul>
                </div>

                <div class="flex flex-col gap-2">
                    <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('Used but unpriced') }}
                    </h4>
                    <p
                        v-if="unpriced.models.length === 0 && unpriced.tools.length === 0"
                        class="text-sm text-muted-foreground"
                        data-testid="usage-install-unpriced-empty"
                    >
                        {{ t('Everything that was used has a price.') }}
                    </p>
                    <ul v-else class="flex flex-col gap-1">
                        <li
                            v-for="(model, index) in unpriced.models"
                            :key="`${model.provider}-${model.model}-${index}`"
                            class="flex items-baseline justify-between gap-3 text-sm"
                            :data-testid="`usage-install-unpriced-model-${index}`"
                        >
                            <span class="truncate font-medium">{{ model.model }}</span>
                            <span class="truncate text-muted-foreground">
                                {{ model.provider === '' ? t('Any provider') : model.provider }}
                            </span>
                            <span class="text-muted-foreground">
                                {{ formatTokens(model.calls, locale) }}
                            </span>
                        </li>
                        <li
                            v-for="(tool, index) in unpriced.tools"
                            :key="`${tool.tool_class}-${index}`"
                            class="flex items-baseline justify-between gap-3 text-sm"
                            :data-testid="`usage-install-unpriced-tool-${index}`"
                        >
                            <span class="truncate font-medium">{{ tool.tool_name }}</span>
                            <span class="truncate font-mono text-xs text-muted-foreground">
                                {{ tool.tool_class }}
                            </span>
                            <span class="text-muted-foreground">
                                {{ formatTokens(tool.calls, locale) }}
                            </span>
                        </li>
                    </ul>
                </div>

                <!-- The calls the principal paid for themselves. They had a
                     price and were not charged: the installation did not
                     pay for them either. -->
                <div class="flex flex-col gap-2">
                    <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('Not billed') }}
                    </h4>
                    <p
                        v-if="notBilledModels.length === 0 && notBilledTools.length === 0"
                        class="text-sm text-muted-foreground"
                        data-testid="usage-install-not-billed-empty"
                    >
                        {{ t('Every call was billed.') }}
                    </p>
                    <ul v-else class="flex flex-col gap-1">
                        <li
                            v-for="(model, index) in notBilledModels"
                            :key="`${model.provider}-${model.model}-${index}`"
                            class="flex items-baseline justify-between gap-3 text-sm"
                            :data-testid="`usage-install-not-billed-model-${index}`"
                        >
                            <span class="truncate font-medium">{{ model.model }}</span>
                            <span class="truncate text-muted-foreground">
                                {{ model.provider === '' ? t('Any provider') : model.provider }}
                            </span>
                            <span class="text-muted-foreground">
                                {{ formatTokens(model.tokens, locale) }}
                            </span>
                        </li>
                        <li
                            v-for="(tool, index) in notBilledTools"
                            :key="`${tool.tool_class}-${index}`"
                            class="flex items-baseline justify-between gap-3 text-sm"
                            :data-testid="`usage-install-not-billed-tool-${index}`"
                        >
                            <span class="truncate font-medium">{{ tool.tool_name }}</span>
                            <span class="truncate font-mono text-xs text-muted-foreground">
                                {{ tool.tool_class }}
                            </span>
                            <span class="text-muted-foreground">
                                {{ formatTokens(tool.calls, locale) }}
                            </span>
                        </li>
                    </ul>
                </div>
            </template>
        </section>

        <!-- The caller's own face. An admin sees it too: the installation
             is a sum of principals, and the admin's own are among them. -->
        <div class="flex flex-col gap-6" data-testid="usage-own">
            <h3 v-if="isAdmin" class="text-sm font-semibold">{{ t('Your usage') }}</h3>

            <section class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold">{{ t('Spend over time') }}</h3>
                    <!-- The fieldset names the group. The box stays on the inner
                         div: a fieldset brings the browser's own border and
                         padding, and this bundle ships no preflight to reset
                         them. -->
                    <fieldset
                        class="m-0 min-w-0 border-0 p-0"
                        data-testid="usage-series-window"
                    >
                        <legend class="sr-only">
                            {{ t('Spend window') }}
                        </legend>
                        <div class="flex items-center gap-1 rounded-lg border border-border p-0.5">
                            <button
                                v-for="option in windows"
                                :key="option"
                                type="button"
                                class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                                :class="option === seriesWindow
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'"
                                :aria-pressed="option === seriesWindow"
                                :data-testid="`usage-series-window-${option}`"
                                @click="seriesWindow = option"
                            >
                                {{ labels.windowLabel[option] }}
                            </button>
                        </div>
                    </fieldset>
                </div>
                <div
                    v-if="seriesLoading"
                    class="text-sm text-muted-foreground"
                    data-testid="usage-series-loading"
                >
                    {{ t('Loading usage…') }}
                </div>
                <div
                    v-else-if="seriesError"
                    class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                    data-testid="usage-series-error"
                >
                    {{ t('Failed to load usage: {error}', { error: seriesError }) }}
                </div>
                <UsageSpendChart v-else :points="series?.points ?? []" :locale="locale" />
            </section>

            <section class="flex flex-col gap-3">
                <h3 class="text-sm font-semibold">{{ t('Your principals') }}</h3>
                <div
                    v-if="principalsLoading"
                    class="text-sm text-muted-foreground"
                    data-testid="usage-overview-loading"
                >
                    {{ t('Loading usage…') }}
                </div>
                <div
                    v-else-if="principalsError"
                    class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                    data-testid="usage-overview-error"
                >
                    {{ t('Failed to load usage: {error}', { error: principalsError }) }}
                </div>
                <div
                    v-else-if="principals.length === 0"
                    class="rounded-lg border border-border p-4 text-sm text-muted-foreground"
                    data-testid="usage-overview-no-principals"
                >
                    {{ t('No principals are visible to you yet.') }}
                </div>
                <article
                    v-for="principal in principals"
                    :key="principal.id"
                    class="flex flex-col gap-3 rounded-xl border border-border p-4"
                    :data-testid="`usage-principal-${principal.id}`"
                >
                    <header class="flex flex-wrap items-baseline justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <h4 class="font-medium">{{ principal.name }}</h4>
                            <span
                                class="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                                {{ labels.principalTypeLabel[principal.type] }}
                            </span>
                        </div>
                        <div class="text-sm">
                            <span class="text-muted-foreground">{{ t('Balance') }}</span>
                            <span
                                class="ml-2 font-medium"
                                :data-testid="`usage-principal-balance-${principal.id}`"
                            >
                                {{ principal.balance === null
                                    ? t('No credit pool')
                                    : formatCredits(principal.balance, locale) }}
                            </span>
                        </div>
                    </header>
                    <UsageLimitTable :limits="principal.limits" :locale="locale" />
                </article>
            </section>
        </div>
    </div>
</template>
