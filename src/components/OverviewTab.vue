<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from '../shims'
import type { SeriesWindow, UsagePrincipal, UsageSeries } from '../types'
import { myPrincipalsPath, seriesPath } from '../lib/usage-api'
import { messageOf } from '../lib/errors'
import { formatCredits } from '../lib/format'
import { useUsageLabels } from '../composables/useUsageLabels'
import UsageLimitTable from './UsageLimitTable.vue'
import UsageSpendChart from './UsageSpendChart.vue'

const props = defineProps<{ hostContext: PluginHostContext }>()

const { t, locale } = useI18n()
const labels = useUsageLabels()

const principals = ref<UsagePrincipal[]>([])
const series = ref<UsageSeries | null>(null)
const seriesWindow = ref<SeriesWindow>('day')
const principalsLoading = ref(true)
const seriesLoading = ref(true)
const principalsError = ref<string | null>(null)
const seriesError = ref<string | null>(null)

const windows: SeriesWindow[] = ['day', 'week', 'month']

async function loadPrincipals(): Promise<void> {
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

async function loadSeries(): Promise<void> {
    seriesLoading.value = true
    seriesError.value = null
    try {
        series.value = await props.hostContext.api.get<UsageSeries>(seriesPath(seriesWindow.value))
    } catch (e) {
        seriesError.value = messageOf(e)
    } finally {
        seriesLoading.value = false
    }
}

onMounted(async () => {
    await Promise.all([loadPrincipals(), loadSeries()])
})

watch(seriesWindow, () => {
    void loadSeries()
})
</script>

<template>
    <div class="flex flex-col gap-6" data-testid="usage-panel-overview">
        <header class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ t('Usage') }}</h2>
            <p class="text-sm text-muted-foreground">
                {{ t('Your balances, your limits and what your spend looks like.') }}
            </p>
        </header>

        <section class="flex flex-col gap-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">{{ t('Spend over time') }}</h3>
                <div
                    class="flex items-center gap-1 rounded-lg border border-border p-0.5"
                    role="group"
                    :aria-label="t('Spend window')"
                    data-testid="usage-series-window"
                >
                    <button
                        v-for="option in windows"
                        :key="option"
                        type="button"
                        class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                        :class="option === seriesWindow
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:text-foreground'"
                        :data-testid="`usage-series-window-${option}`"
                        @click="seriesWindow = option"
                    >
                        {{ labels.windowLabel[option] }}
                    </button>
                </div>
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
</template>
