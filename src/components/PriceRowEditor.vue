<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PriceKind, UsagePrice } from '../types'
import { formatExactPrice, formatPricePerMillion } from '../lib/format'
import { inputNumberOrZero } from '../lib/inputs'

const props = defineProps<{
    price: UsagePrice
    index: number
    locale: string
    idPrefix: string
}>()

const emit = defineEmits<{
    (event: 'change', price: UsagePrice): void
    (event: 'remove'): void
}>()

const { t } = useI18n()

const kinds: PriceKind[] = ['model', 'tool']

const priceFields = ['input_price', 'output_price', 'cached_price', 'call_price'] as const

type PriceField = (typeof priceFields)[number]

const draft = ref<UsagePrice>({ ...props.price })

/**
 * The text of each price field, apart from the number the row carries.
 *
 * A number field cannot hold the price the operator is typing: "0.000002"
 * parses as 0 until the last digit is there, and a field bound to that
 * number is rewritten under the cursor. The text is therefore the field's
 * own, and the parsed number is what the row hands back.
 */
const texts = ref<Record<PriceField, string>>({
    input_price: String(props.price.input_price),
    output_price: String(props.price.output_price),
    cached_price: String(props.price.cached_price),
    call_price: String(props.price.call_price),
})

watch(
    () => props.price,
    (price) => {
        for (const field of priceFields) {
            // The parent hands the row back after every keystroke, and the
            // text the operator is typing parses to the number the parent
            // already holds — resyncing then would eat the digits. A number
            // that really changed replaces the text.
            if (draft.value[field] !== price[field]) {
                texts.value[field] = String(price[field])
            }
        }
        draft.value = { ...price }
    },
)

function commit(): void {
    emit('change', { ...draft.value })
}

function setKind(event: Event): void {
    draft.value.kind = (event.target as HTMLSelectElement).value as PriceKind
    commit()
}

function setText(field: 'provider' | 'key' | 'operation', event: Event): void {
    draft.value[field] = (event.target as HTMLInputElement).value
    commit()
}

function setPrice(field: PriceField, event: Event): void {
    const input = event.target as HTMLInputElement
    texts.value[field] = input.value
    draft.value[field] = inputNumberOrZero(event)
    commit()
}
</script>

<template>
    <tr
        class="border-b border-border/60 align-top last:border-0"
        :data-testid="`usage-price-editor-${index}`"
    >
        <td class="py-2 pr-2">
            <!-- The column header is the visible caption; the label repeats
                 those words for a screen reader, so it stays out of the layout. -->
            <label
                class="sr-only"
                :for="`${idPrefix}-price-kind-${index}`"
            >
                {{ t('Kind') }}
            </label>
            <select
                :id="`${idPrefix}-price-kind-${index}`"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.kind"
                :data-testid="`usage-price-kind-${index}`"
                @change="setKind"
            >
                <option
                    v-for="option in kinds"
                    :key="option"
                    :value="option"
                >
                    {{ option === 'model' ? t('Model') : t('Tool') }}
                </option>
            </select>
        </td>
        <td class="py-2 pr-2">
            <label
                class="sr-only"
                :for="`${idPrefix}-price-provider-${index}`"
            >
                {{ t('Provider') }}
            </label>
            <input
                :id="`${idPrefix}-price-provider-${index}`"
                type="text"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.provider"
                :placeholder="t('Any provider')"
                :data-testid="`usage-price-provider-${index}`"
                @input="setText('provider', $event)"
            >
        </td>
        <td class="py-2 pr-2">
            <label
                class="sr-only"
                :for="`${idPrefix}-price-key-${index}`"
            >
                {{ t('Key') }}
            </label>
            <input
                :id="`${idPrefix}-price-key-${index}`"
                type="text"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.key"
                :data-testid="`usage-price-key-${index}`"
                @input="setText('key', $event)"
            >
        </td>
        <td class="py-2 pr-2">
            <label
                v-if="draft.kind === 'tool'"
                class="sr-only"
                :for="`${idPrefix}-price-operation-${index}`"
            >
                {{ t('Operation') }}
            </label>
            <input
                v-if="draft.kind === 'tool'"
                :id="`${idPrefix}-price-operation-${index}`"
                type="text"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.operation"
                :placeholder="t('Any operation')"
                :data-testid="`usage-price-operation-${index}`"
                @input="setText('operation', $event)"
            >
            <span v-else class="text-xs text-muted-foreground">{{ t('Not applicable') }}</span>
        </td>
        <td
            class="py-2 pr-2 text-right"
            :title="t('{value} credits per input token', { value: formatExactPrice(draft.input_price, locale) })"
        >
            <label
                class="sr-only"
                :for="`${idPrefix}-price-input-${index}`"
            >
                {{ t('Input') }}
            </label>
            <input
                :id="`${idPrefix}-price-input-${index}`"
                type="number"
                min="0"
                step="any"
                class="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                :value="texts.input_price"
                :data-testid="`usage-price-input-${index}`"
                @input="setPrice('input_price', $event)"
            >
            <div
                class="mt-0.5 text-xs text-muted-foreground"
                :data-testid="`usage-price-input-million-${index}`"
            >
                {{ formatPricePerMillion(draft.input_price, locale) }}
            </div>
        </td>
        <td
            class="py-2 pr-2 text-right"
            :title="t('{value} credits per output token', { value: formatExactPrice(draft.output_price, locale) })"
        >
            <label
                class="sr-only"
                :for="`${idPrefix}-price-output-${index}`"
            >
                {{ t('Output') }}
            </label>
            <input
                :id="`${idPrefix}-price-output-${index}`"
                type="number"
                min="0"
                step="any"
                class="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                :value="texts.output_price"
                :data-testid="`usage-price-output-${index}`"
                @input="setPrice('output_price', $event)"
            >
            <div class="mt-0.5 text-xs text-muted-foreground">
                {{ formatPricePerMillion(draft.output_price, locale) }}
            </div>
        </td>
        <td
            class="py-2 pr-2 text-right"
            :title="t('{value} credits per cached input token', { value: formatExactPrice(draft.cached_price, locale) })"
        >
            <label
                class="sr-only"
                :for="`${idPrefix}-price-cached-${index}`"
            >
                {{ t('Cached') }}
            </label>
            <input
                :id="`${idPrefix}-price-cached-${index}`"
                type="number"
                min="0"
                step="any"
                class="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                :value="texts.cached_price"
                :data-testid="`usage-price-cached-${index}`"
                @input="setPrice('cached_price', $event)"
            >
            <div class="mt-0.5 text-xs text-muted-foreground">
                {{ formatPricePerMillion(draft.cached_price, locale) }}
            </div>
        </td>
        <td
            class="py-2 pr-2 text-right"
            :title="t('{value} credits per call', { value: formatExactPrice(draft.call_price, locale) })"
        >
            <label
                v-if="draft.kind === 'tool'"
                class="sr-only"
                :for="`${idPrefix}-price-call-${index}`"
            >
                {{ t('Per call') }}
            </label>
            <input
                v-if="draft.kind === 'tool'"
                :id="`${idPrefix}-price-call-${index}`"
                type="number"
                min="0"
                step="any"
                class="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                :value="texts.call_price"
                :data-testid="`usage-price-call-${index}`"
                @input="setPrice('call_price', $event)"
            >
            <span v-else class="text-xs text-muted-foreground">{{ t('Not applicable') }}</span>
        </td>
        <td class="py-2">
            <button
                type="button"
                class="rounded-md border border-border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                :aria-label="t('Remove price {number}', { number: index + 1 })"
                :data-testid="`usage-price-remove-${index}`"
                @click="emit('remove')"
            >
                {{ t('Remove') }}
            </button>
        </td>
    </tr>
</template>
