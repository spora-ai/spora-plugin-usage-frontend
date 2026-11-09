<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UsageLimit } from '../types'
import { formatCredits, limitUsage } from '../lib/format'
import { useUsageLabels } from '../composables/useUsageLabels'

defineProps<{
    limits: UsageLimit[]
    locale: string
}>()

const { t } = useI18n()
const labels = useUsageLabels()

/**
 * The used fraction of the cap as a percentage, for the bar under the row.
 */
function usageWidth(limit: UsageLimit): string {
    return `${Math.round(limitUsage(limit.spend, limit.cap) * 100)}%`
}

function isOverCap(limit: UsageLimit): boolean {
    return limitUsage(limit.spend, limit.cap) >= 1
}
</script>

<template>
    <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
            <thead>
                <tr class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th class="py-2 pr-3 font-medium">{{ t('Window') }}</th>
                    <th class="py-2 pr-3 font-medium">{{ t('Unit') }}</th>
                    <th class="py-2 pr-3 text-right font-medium">{{ t('Limit') }}</th>
                    <th class="py-2 pr-3 text-right font-medium">{{ t('Spent') }}</th>
                    <th class="py-2 pr-3 text-right font-medium">{{ t('Left') }}</th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="(limit, index) in limits"
                    :key="`${limit.window}-${limit.unit}-${index}`"
                    class="border-b border-border/60 last:border-0"
                    :class="limit.enabled ? '' : 'opacity-60'"
                    :data-testid="`usage-limit-row-${index}`"
                >
                    <td class="py-2 pr-3 align-top">
                        <span class="font-medium">{{ labels.windowLabel[limit.window] }}</span>
                        <span
                            v-if="limit.window === 'rolling'"
                            class="ml-1 text-xs text-muted-foreground"
                        >
                            {{ t('{hours} h', { hours: limit.window_size }) }}
                        </span>
                        <span
                            class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                        >
                            {{ labels.modeLabel[limit.mode] }}
                        </span>
                        <span
                            v-if="!limit.enabled"
                            class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                        >
                            {{ t('Off') }}
                        </span>
                    </td>
                    <td class="py-2 pr-3 align-top text-muted-foreground">
                        {{ labels.unitLabel[limit.unit] }}
                    </td>
                    <td class="py-2 pr-3 text-right align-top">
                        {{ formatCredits(limit.cap, locale) }}
                    </td>
                    <td class="py-2 pr-3 text-right align-top">
                        {{ formatCredits(limit.spend, locale) }}
                    </td>
                    <td class="py-2 pr-3 text-right align-top">
                        <span :class="isOverCap(limit) ? 'text-destructive' : ''">
                            {{ formatCredits(limit.remaining, locale) }}
                        </span>
                        <span class="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted">
                            <span
                                class="block h-full rounded-full"
                                :class="isOverCap(limit) ? 'bg-destructive' : 'bg-primary'"
                                :style="{ width: usageWidth(limit) }"
                            />
                        </span>
                    </td>
                </tr>
                <tr v-if="limits.length === 0">
                    <td colspan="5" class="py-3 text-sm text-muted-foreground">
                        {{ t('No limits are set.') }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
