<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UsageSeriesPoint } from '../types'
import { formatCredits, formatTimestamp, formatTokens } from '../lib/format'

const props = defineProps<{
    points: UsageSeriesPoint[]
    locale: string
}>()

const { t } = useI18n()

const maxCredits = computed(() =>
    props.points.reduce((max, point) => Math.max(max, point.credits), 0),
)

/**
 * The height of one bar, as a percentage of the tallest bar.
 *
 * The chart is drawn with plain divs: the bundle omits Tailwind's preflight,
 * and the utilities that would resize a bar read CSS variables Tailwind v3
 * defines in the same rule as its preflight, so without them they would
 * silently do nothing.
 */
function barHeight(point: UsageSeriesPoint): string {
    if (maxCredits.value <= 0) {
        return '0%'
    }
    return `${Math.round((point.credits / maxCredits.value) * 100)}%`
}

const totals = computed(() => {
    let credits = 0
    let totalTokens = 0
    let outputTokens = 0
    let llmCalls = 0
    let toolCalls = 0
    for (const point of props.points) {
        credits += point.credits
        totalTokens += point.total_tokens
        outputTokens += point.output_tokens
        llmCalls += point.llm_calls
        toolCalls += point.tool_calls
    }
    return { credits, totalTokens, outputTokens, llmCalls, toolCalls }
})
</script>

<template>
    <div class="flex flex-col gap-3">
        <div
            v-if="points.length === 0"
            class="rounded-lg border border-border p-4 text-sm text-muted-foreground"
            data-testid="usage-spend-empty"
        >
            {{ t('No spend recorded in this window.') }}
        </div>
        <template v-else>
            <div class="flex h-32 items-end gap-1" data-testid="usage-spend-chart">
                <div
                    v-for="(point, index) in points"
                    :key="`${point.at}-${index}`"
                    class="flex h-full flex-1 flex-col justify-end"
                    :title="`${formatTimestamp(point.at, locale)} — ${formatCredits(point.credits, locale)}`"
                    :data-testid="`usage-spend-bar-${index}`"
                >
                    <div
                        class="w-full rounded-t bg-primary/70"
                        :style="{ height: barHeight(point) }"
                    />
                </div>
            </div>
            <dl class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <div class="flex gap-1">
                    <dt>{{ t('Credits') }}</dt>
                    <dd
                        class="font-medium text-foreground"
                        data-testid="usage-spend-total-credits"
                    >
                        {{ formatCredits(totals.credits, locale) }}
                    </dd>
                </div>
                <div class="flex gap-1">
                    <dt>{{ t('Total tokens') }}</dt>
                    <dd
                        class="font-medium text-foreground"
                        data-testid="usage-spend-total-tokens"
                    >
                        {{ formatTokens(totals.totalTokens, locale) }}
                    </dd>
                </div>
                <div class="flex gap-1">
                    <dt>{{ t('Output tokens') }}</dt>
                    <dd
                        class="font-medium text-foreground"
                        data-testid="usage-spend-total-output-tokens"
                    >
                        {{ formatTokens(totals.outputTokens, locale) }}
                    </dd>
                </div>
                <div class="flex gap-1">
                    <dt>{{ t('LLM calls') }}</dt>
                    <dd
                        class="font-medium text-foreground"
                        data-testid="usage-spend-total-llm-calls"
                    >
                        {{ formatTokens(totals.llmCalls, locale) }}
                    </dd>
                </div>
                <div class="flex gap-1">
                    <dt>{{ t('Tool calls') }}</dt>
                    <dd
                        class="font-medium text-foreground"
                        data-testid="usage-spend-total-tool-calls"
                    >
                        {{ formatTokens(totals.toolCalls, locale) }}
                    </dd>
                </div>
            </dl>
        </template>
    </div>
</template>
