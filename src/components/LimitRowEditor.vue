<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LimitMode, LimitUnit, LimitWindow, UsageLimitDraft } from '../types'
import { formatCredits } from '../lib/format'
import { inputNumber, inputNumberOrZero } from '../lib/inputs'
import { useUsageLabels } from '../composables/useUsageLabels'

const props = withDefaults(
    defineProps<{
        limit: UsageLimitDraft
        index: number
        locale: string
        idPrefix: string
        /**
         * The namespace of the row's test ids.
         *
         * A tab that shows the editor more than once — the Defaults tab
         * has a table per scope — would otherwise put the same test id on
         * three rows, and a test could no longer say which one it meant.
         */
        testIdPrefix?: string
        /**
         * Whether the row shows what the window has spent.
         *
         * A default limit governs principals nobody configured, so there
         * is no spend of its own to report: the column would be a column
         * of dashes.
         */
        showFigures?: boolean
    }>(),
    {
        testIdPrefix: 'usage-limit',
        showFigures: true,
    },
)

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

/**
 * The text of the cap field.
 *
 * A number field cannot hold the cap the operator is typing: "100.50"
 * parses as 100 until the last digit is there, and a field bound to that
 * number is rewritten under the cursor. The text is therefore the field's
 * own, and the cap is what the row carries.
 */
const capText = ref(String(props.limit.cap))

watch(
    () => props.limit,
    (limit) => {
        // The parent hands the row back after every keystroke, and the text
        // the operator is typing parses to the number the parent already
        // holds — resyncing then would eat the digits. A number that
        // really changed replaces the text.
        if (draft.value.cap !== limit.cap) {
            capText.value = String(limit.cap)
        }
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
    capText.value = (event.target as HTMLInputElement).value
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
        :data-testid="`${testIdPrefix}-editor-${index}`"
    >
        <td class="py-2 pr-2">
            <!-- The column header is the visible caption; the label repeats
                 those words for a screen reader, so it stays out of the layout. -->
            <label
                class="sr-only"
                :for="`${idPrefix}-limit-window-${index}`"
            >
                {{ t('Window') }}
            </label>
            <select
                :id="`${idPrefix}-limit-window-${index}`"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.window"
                :data-testid="`${testIdPrefix}-window-${index}`"
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
                :for="`${idPrefix}-limit-window-size-${index}`"
            >
                {{ t('Window size') }}
            </label>
            <input
                v-if="draft.window === 'rolling'"
                :id="`${idPrefix}-limit-window-size-${index}`"
                type="number"
                min="1"
                class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.window_size"
                :data-testid="`${testIdPrefix}-window-size-${index}`"
                @input="setWindowSize"
            >
        </td>
        <td class="py-2 pr-2">
            <label
                class="sr-only"
                :for="`${idPrefix}-limit-unit-${index}`"
            >
                {{ t('Unit') }}
            </label>
            <select
                :id="`${idPrefix}-limit-unit-${index}`"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.unit"
                :data-testid="`${testIdPrefix}-unit-${index}`"
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
                :for="`${idPrefix}-limit-cap-${index}`"
            >
                {{ t('Limit') }}
            </label>
            <input
                :id="`${idPrefix}-limit-cap-${index}`"
                type="number"
                min="0"
                step="any"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="capText"
                :data-testid="`${testIdPrefix}-cap-${index}`"
                @input="setCap"
            >
        </td>
        <td class="py-2 pr-2">
            <label
                class="sr-only"
                :for="`${idPrefix}-limit-mode-${index}`"
            >
                {{ t('Mode') }}
            </label>
            <select
                :id="`${idPrefix}-limit-mode-${index}`"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.mode"
                :data-testid="`${testIdPrefix}-mode-${index}`"
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
            v-if="showFigures"
            class="py-2 pr-2 text-right text-xs text-muted-foreground"
            :data-testid="`${testIdPrefix}-figures-${index}`"
        >
            <div>{{ formatCredits(draft.spend, locale) }}</div>
            <div>{{ formatCredits(draft.remaining, locale) }}</div>
        </td>
        <td class="py-2 pr-2">
            <label class="flex items-center gap-1.5 text-xs">
                <input
                    type="checkbox"
                    :checked="draft.enabled"
                    :data-testid="`${testIdPrefix}-enabled-${index}`"
                    @change="setEnabled"
                >
                {{ t('Enabled') }}
            </label>
        </td>
        <td class="py-2">
            <button
                type="button"
                class="rounded-md border border-border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                :aria-label="t('Remove limit {number}', { number: index + 1 })"
                :data-testid="`${testIdPrefix}-remove-${index}`"
                @click="emit('remove')"
            >
                {{ t('Remove') }}
            </button>
        </td>
    </tr>
</template>
