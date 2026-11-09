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
}>()

const emit = defineEmits<{
    (event: 'change', price: UsagePrice): void
    (event: 'remove'): void
}>()

const { t } = useI18n()

const kinds: PriceKind[] = ['model', 'tool']

const draft = ref<UsagePrice>({ ...props.price })

watch(
    () => props.price,
    (price) => {
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

function setPrice(field: 'input_price' | 'output_price' | 'cached_price' | 'call_price', event: Event): void {
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
            <select
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
            <input
                type="text"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.provider"
                :placeholder="t('Any provider')"
                :data-testid="`usage-price-provider-${index}`"
                @input="setText('provider', $event)"
            >
        </td>
        <td class="py-2 pr-2">
            <input
                type="text"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.key"
                :data-testid="`usage-price-key-${index}`"
                @input="setText('key', $event)"
            >
        </td>
        <td class="py-2 pr-2">
            <input
                v-if="draft.kind === 'tool'"
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
            <input
                type="number"
                min="0"
                step="any"
                class="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                :value="draft.input_price"
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
            <input
                type="number"
                min="0"
                step="any"
                class="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                :value="draft.output_price"
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
            <input
                type="number"
                min="0"
                step="any"
                class="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                :value="draft.cached_price"
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
            <input
                v-if="draft.kind === 'tool'"
                type="number"
                min="0"
                step="any"
                class="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                :value="draft.call_price"
                :data-testid="`usage-price-call-${index}`"
                @input="setPrice('call_price', $event)"
            >
            <span v-else class="text-xs text-muted-foreground">{{ t('Not applicable') }}</span>
        </td>
        <td class="py-2">
            <button
                type="button"
                class="rounded-md border border-border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                :data-testid="`usage-price-remove-${index}`"
                @click="emit('remove')"
            >
                {{ t('Remove') }}
            </button>
        </td>
    </tr>
</template>
