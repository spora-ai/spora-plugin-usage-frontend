<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PriceKind, UsageKnownModel, UsageKnownTool, UsagePrice } from '../types'
import { formatExactPrice, formatPricePerMillion } from '../lib/format'
import { inputNumberOrZero } from '../lib/inputs'

const props = defineProps<{
    price: UsagePrice
    index: number
    locale: string
    idPrefix: string
    knownModels: UsageKnownModel[]
    knownTools: UsageKnownTool[]
}>()

const emit = defineEmits<{
    (event: 'change', price: UsagePrice): void
    (event: 'remove'): void
}>()

const { t } = useI18n()

const kinds: PriceKind[] = ['model', 'tool']

const priceFields = ['input_price', 'output_price', 'cached_price', 'call_price'] as const

type PriceField = (typeof priceFields)[number]

/** The option that means "the operator will type the key themselves". */
const CUSTOM = '__custom__'

const draft = ref<UsagePrice>({ ...props.price })

/**
 * The text of each price field, apart from the number the row carries.
 *
 * A number field cannot hold the price the operator is typing: "0.000002"
 * parses to 0 until the last digit is there, and a field bound to that
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

/**
 * The models and tools the installation knows about.
 *
 * A model's identity is the pair — the price book keys it on the provider
 * *and* the name — so the option carries both. A tool's identity is its
 * class, which is what the book keys it on; the wire name is only a label.
 */
const knownOptions = computed<{ value: string; label: string; title: string }[]>(() => {
    const options: { value: string; label: string; title: string }[] =
        draft.value.kind === 'tool'
            ? props.knownTools.map((tool) => ({
                  value: tool.tool_class,
                  label: tool.tool_name,
                  title: tool.tool_class,
              }))
            : props.knownModels.map((model) => ({
                  value: JSON.stringify({ provider: model.provider, model: model.model }),
                  label:
                      model.provider === '' ? model.model : `${model.provider} / ${model.model}`,
                  title: model.model,
              }))

    // The row's own value, when the installation does not know it. A
    // dropdown whose value matches no option renders blank, and a row
    // that looks empty is a row whose price the operator cannot see.
    if (
        draft.value.key !== '' &&
        !options.some((option) => option.value === currentOption.value)
    ) {
        options.push({
            value: currentOption.value,
            label: draft.value.key,
            title: draft.value.key,
        })
    }

    return options
})

/** The option that matches what the row currently carries. */
const currentOption = computed(() => {
    if (draft.value.kind === 'tool') {
        return draft.value.key
    }
    return JSON.stringify({ provider: draft.value.provider, model: draft.value.key })
})

/**
 * The dropdown's value.
 *
 * The free-text field is always there, so the dropdown is a shortcut that
 * fills it rather than a gate in front of it: the option that matches the
 * key is the one shown, and "Other…" is what a key the installation does
 * not know looks like.
 */
const selectedOption = computed(() => {
    const known = knownOptions.value.some((option) => option.value === currentOption.value)
    return known ? currentOption.value : CUSTOM
})

function commit(): void {
    emit('change', { ...draft.value })
}

function setKind(event: Event): void {
    const kind = (event.target as HTMLSelectElement).value as PriceKind
    draft.value.kind = kind

    // The server refuses a provider on a tool price and an operation on a
    // model price, so the two columns that do not apply are cleared rather
    // than left to make the save fail.
    if (kind === 'tool') {
        draft.value.provider = ''
    } else {
        draft.value.operation = ''
    }

    commit()
}

/**
 * Fill the row from the option that was picked.
 *
 * A model brings its provider with it — the pair is the book's key — and
 * a tool is keyed on its class, which the wire name does not carry.
 */
function chooseOption(event: Event): void {
    const value = (event.target as HTMLSelectElement).value

    if (value === CUSTOM) {
        // "Other…" is what a key the installation does not know looks
        // like; the field below is where the operator types it.
        return
    }

    if (draft.value.kind === 'tool') {
        draft.value.key = value
        draft.value.provider = ''
    } else {
        const picked = JSON.parse(value) as { provider: string; model: string }
        draft.value.provider = picked.provider
        draft.value.key = picked.model
    }

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
                v-if="draft.kind === 'model'"
                class="sr-only"
                :for="`${idPrefix}-price-provider-${index}`"
            >
                {{ t('Provider') }}
            </label>
            <input
                v-if="draft.kind === 'model'"
                :id="`${idPrefix}-price-provider-${index}`"
                type="text"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.provider"
                :placeholder="t('Any provider')"
                :data-testid="`usage-price-provider-${index}`"
                @input="setText('provider', $event)"
            >
            <span v-else class="text-xs text-muted-foreground">{{ t('Not applicable') }}</span>
        </td>
        <td class="py-2 pr-2">
            <label
                class="sr-only"
                :for="`${idPrefix}-price-key-${index}`"
            >
                {{ t('Model or tool') }}
            </label>
            <select
                :id="`${idPrefix}-price-key-${index}`"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="selectedOption"
                :data-testid="`usage-price-key-select-${index}`"
                @change="chooseOption"
            >
                <option
                    v-for="option in knownOptions"
                    :key="option.value"
                    :value="option.value"
                    :title="option.title"
                >
                    {{ option.label }}
                </option>
                <option :value="CUSTOM">
                    {{ t('Other…') }}
                </option>
            </select>
            <!-- The free-text field is always there: the dropdown is a
                 shortcut that fills it, not a gate in front of it. -->
            <input
                :id="`${idPrefix}-price-key-${index}`"
                type="text"
                class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                :value="draft.key"
                :placeholder="draft.kind === 'tool' ? t('Tool class') : t('Model name')"
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
