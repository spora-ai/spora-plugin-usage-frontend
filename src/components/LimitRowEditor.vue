<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LimitMode, LimitUnit, LimitWindow, UsageLimitDraft } from '../types'
import { formatCredits } from '../lib/format'
import { inputNumber, inputNumberOrZero } from '../lib/inputs'
import { useUsageLabels } from '../composables/useUsageLabels'

const props = defineProps<{
    limit: UsageLimitDraft
    index: number
    locale: string
}>()

const emit = defineEmits<{
    (event: 'change', limit: UsageLimitDraft): void
    (event: 'remove'): void
}>()

const { t } = useI18n()
const labels = useUsageLabels()

const windows: LimitWindow[] = ['hour', 'day', 'week', 'month', 'rolling', 'total']
const units: LimitUnit[] = ['credits', 'total_tokens', 'output_tokens', 'llm_calls', 'tool_calls']
const modes: LimitMode[] = ['hard', 'soft']

/**
 * The row the operator is editing.
 *
 * The parent owns the row; this copy is what the inputs bind to, and every
 * change is handed back whole rather than mutated into the parent's row.
 */
const draft = ref<UsageLimitDraft>({ ...props.limit })

watch(
    () => props.limit,
    (limit) => {
        draft.value = { ...limit }
    },
)

function commit(): void {
    emit('change', { ...draft.value })
}

function setWindow(event: Event): void {
    draft.value.window = (event.target as HTMLSelectElement).value as LimitWindow
    commit()
}

function setUnit(event: Event): void {
    draft.value.unit = (event.target as HTMLSelectElement).value as LimitUnit
    commit()
}

function setMode(event: Event): void {
    draft.value.mode = (event.target as HTMLSelectElement).value as LimitMode
    commit()
}

function setEnabled(event: Event): void {
    draft.value.enabled = (event.target as HTMLInputElement).checked
    commit()
}

function setCap(event: Event): void {
    // The server stores a cap in a NOT NULL column, so a row always has a
    // number: an emptied field reads as zero rather than as "no cap".
    draft.value.cap = inputNumberOrZero(event)
    commit()
}

function setWindowSize(event: Event): void {
    draft.value.window_size = inputNumber(event) ?? 1
    commit()
}
</script>

<template>
    <tr
        class="border-b border-border/60 align-top last:border-0"
        :data-testid="`usage-limit-editor-${index}`"
    >
        <td class="py-2 pr-2">
            <!-- The column header is the visible caption; the label repeats
                 those words for a screen reader, so it stays out of the layout. -->
            <label
                class="sr-only"
                :for="`usage-limit-window-${index}`"
            >
                {{ t('Window') }}
            </label>
            <select
                :id="`usage-limit-window-${index}`"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.window"
                :data-testid="`usage-limit-window-${index}`"
                @change="setWindow"
            >
                <option
                    v-for="option in windows"
                    :key="option"
                    :value="option"
                >
                    {{ labels.windowLabel[option] }}
                </option>
            </select>
            <label
                v-if="draft.window === 'rolling'"
                class="sr-only"
                :for="`usage-limit-window-size-${index}`"
            >
                {{ t('Window size') }}
            </label>
            <input
                v-if="draft.window === 'rolling'"
                :id="`usage-limit-window-size-${index}`"
                type="number"
                min="1"
                class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.window_size"
                :data-testid="`usage-limit-window-size-${index}`"
                @input="setWindowSize"
            >
        </td>
        <td class="py-2 pr-2">
            <label
                class="sr-only"
                :for="`usage-limit-unit-${index}`"
            >
                {{ t('Unit') }}
            </label>
            <select
                :id="`usage-limit-unit-${index}`"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.unit"
                :data-testid="`usage-limit-unit-${index}`"
                @change="setUnit"
            >
                <option
                    v-for="option in units"
                    :key="option"
                    :value="option"
                >
                    {{ labels.unitLabel[option] }}
                </option>
            </select>
        </td>
        <td class="py-2 pr-2">
            <label
                class="sr-only"
                :for="`usage-limit-cap-${index}`"
            >
                {{ t('Limit') }}
            </label>
            <input
                :id="`usage-limit-cap-${index}`"
                type="number"
                min="0"
                step="any"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.cap"
                :data-testid="`usage-limit-cap-${index}`"
                @input="setCap"
            >
        </td>
        <td class="py-2 pr-2">
            <label
                class="sr-only"
                :for="`usage-limit-mode-${index}`"
            >
                {{ t('Mode') }}
            </label>
            <select
                :id="`usage-limit-mode-${index}`"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.mode"
                :data-testid="`usage-limit-mode-${index}`"
                @change="setMode"
            >
                <option
                    v-for="option in modes"
                    :key="option"
                    :value="option"
                >
                    {{ labels.modeLabel[option] }}
                </option>
            </select>
        </td>
        <td
            class="py-2 pr-2 text-right text-xs text-muted-foreground"
            :data-testid="`usage-limit-figures-${index}`"
        >
            <div>{{ formatCredits(draft.spend, locale) }}</div>
            <div>{{ formatCredits(draft.remaining, locale) }}</div>
        </td>
        <td class="py-2 pr-2">
            <label class="flex items-center gap-1.5 text-xs">
                <input
                    type="checkbox"
                    :checked="draft.enabled"
                    :data-testid="`usage-limit-enabled-${index}`"
                    @change="setEnabled"
                >
                {{ t('Enabled') }}
            </label>
        </td>
        <td class="py-2">
            <button
                type="button"
                class="rounded-md border border-border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                :data-testid="`usage-limit-remove-${index}`"
                @click="emit('remove')"
            >
                {{ t('Remove') }}
            </button>
        </td>
    </tr>
</template>
