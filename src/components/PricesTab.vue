<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from '../shims'
import type {
    UsageKnownModel,
    UsageKnownTool,
    UsagePrice,
    UsagePricesResponse,
    UsageUnpriced,
} from '../types'
import { pricesPath, unpricedPath } from '../lib/usage-api'
import { isForbidden, messageOf } from '../lib/errors'
import { formatTokens } from '../lib/format'
import { useUsageStore } from '../stores/usage'
import PriceRowEditor from './PriceRowEditor.vue'

const props = defineProps<{ hostContext: PluginHostContext; idPrefix: string }>()

const { t, locale } = useI18n()
const store = useUsageStore()

const prices = ref<UsagePrice[]>([])
const unpriced = ref<UsageUnpriced>({ models: [], tools: [] })
const loading = ref(true)
const saving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saved = ref(false)

/**
 * The unpriced report as the panel holds it.
 *
 * The server may leave the rows out of the answer entirely, so the panel
 * reads them as empty rather than as a missing key.
 */
function toUnpriced(response: UsageUnpriced): UsageUnpriced {
    return {
        models: response.models ?? [],
        tools: response.tools ?? [],
    }
}

async function load(): Promise<void> {
    loading.value = true
    loadError.value = null
    saved.value = false
    try {
        const [priceResponse, unpricedResponse] = await Promise.all([
            props.hostContext.api.get<UsagePricesResponse>(pricesPath()),
            props.hostContext.api.get<UsageUnpriced>(unpricedPath()),
        ])
        prices.value = (priceResponse.prices ?? []).map((price) => ({ ...price }))
        unpriced.value = toUnpriced(unpricedResponse)
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        loadError.value = messageOf(e)
    } finally {
        loading.value = false
    }
}

function updateRow(index: number, price: UsagePrice): void {
    prices.value = prices.value.map((row, position) => (position === index ? price : row))
}

/**
 * The models the installation knows about.
 *
 * Two sources, and together they are the whole set: a model with a price
 * row is in the book, and a model without one is in the unpriced report.
 * A model in neither has never been used here — the operator can still
 * enter it, but the dropdown does not offer what the installation has
 * never seen.
 */
const knownModels = computed<UsageKnownModel[]>(() => {
    const found = new Map<string, UsageKnownModel>()

    for (const price of prices.value) {
        if (price.kind !== 'model' || price.key === '') {
            // A row with no key is a row the operator has not filled in, not
            // a model the installation uses.
            continue
        }
        found.set(JSON.stringify([price.provider, price.key]), {
            provider: price.provider,
            model: price.key,
        })
    }

    for (const model of unpriced.value.models) {
        found.set(JSON.stringify([model.provider, model.model]), {
            provider: model.provider,
            model: model.model,
        })
    }

    return [...found.values()].sort((a, b) => a.model.localeCompare(b.model))
})

/**
 * The tools the installation knows about.
 *
 * The book keys a tool on its class, and the class is what the price row
 * carries. The label is the wire name the installation knows the tool by —
 * `weather` rather than `Spora\Tools\WeatherTool` — because the class is
 * an implementation detail. A tool the installation has no name for is
 * labelled with its class, which is all the price row can say about it.
 */
const knownTools = computed<UsageKnownTool[]>(() => {
    const classes = new Map<string, string>()

    for (const price of prices.value) {
        if (price.kind !== 'tool' || price.key === '') {
            continue
        }
        classes.set(price.key, price.key)
    }

    // The unpriced report knows the wire name of every tool it has seen,
    // and it knows it for the tools that have a price row as well: the
    // name is the better label, so it wins over the class.
    for (const tool of unpriced.value.tools) {
        classes.set(tool.tool_class, tool.tool_name)
    }

    return [...classes.entries()]
        .map(([tool_class, tool_name]) => ({ tool_class, tool_name }))
        .sort((a, b) => a.tool_name.localeCompare(b.tool_name))
})

/**
 * The unpriced report, read again.
 *
 * A price that was just given changes what the server reports as free, so
 * the report is read again rather than left as it was when the tab was
 * opened. A failure here is not a failed save — the book was stored — so
 * the report stays as it was.
 */
async function refreshUnpriced(): Promise<void> {
    try {
        const response = await props.hostContext.api.get<UsageUnpriced>(unpricedPath())
        unpriced.value = toUnpriced(response)
    } catch {
        // The list stays as it was.
    }
}

function addRow(): void {
    prices.value = [
        ...prices.value,
        {
            kind: 'model',
            provider: '',
            key: '',
            operation: '',
            input_price: 0,
            output_price: 0,
            cached_price: 0,
            call_price: 0,
        },
    ]
}

function removeRow(index: number): void {
    prices.value = prices.value.filter((_row, position) => position !== index)
}

async function save(): Promise<void> {
    saving.value = true
    saveError.value = null
    saved.value = false
    try {
        const response = await props.hostContext.api.put<UsagePricesResponse>(pricesPath(), {
            prices: prices.value,
        })
        prices.value = (response.prices ?? []).map((price) => ({ ...price }))
        saved.value = true
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        saveError.value = messageOf(e)
        return
    } finally {
        saving.value = false
    }
    await refreshUnpriced()
}

onMounted(() => {
    void load()
})
</script>

<template>
    <div class="flex flex-col gap-6" data-testid="usage-panel-prices">
        <header class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ t('Prices') }}</h2>
            <p class="text-sm text-muted-foreground">
                {{ t('What each model and each tool costs, and what is used for nothing yet.') }}
            </p>
        </header>

        <div
            v-if="loading"
            class="text-sm text-muted-foreground"
            data-testid="usage-prices-loading"
        >
            {{ t('Loading prices…') }}
        </div>
        <div
            v-else-if="loadError"
            class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            data-testid="usage-prices-error"
        >
            {{ t('Failed to load prices: {error}', { error: loadError }) }}
        </div>

        <template v-else>
            <section class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold">{{ t('Price book') }}</h3>
                    <button
                        type="button"
                        class="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                        data-testid="usage-prices-add"
                        @click="addRow"
                    >
                        {{ t('Add price') }}
                    </button>
                </div>
                <p class="text-xs text-muted-foreground">
                    {{ t('The token prices are entered per token and shown per million tokens.') }}
                </p>

                <div class="overflow-x-auto">
                    <!-- A minimum width, so the table scrolls rather than
                         squeezing its columns: a select that is narrower
                         than its longest option clips the text, and a
                         clipped "Model" reads as "Mode". -->
                    <table class="w-full min-w-[1180px] text-left text-sm">
                        <thead>
                            <tr class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                <th class="py-2 pr-2 font-medium">{{ t('Kind') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Provider') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Model or tool') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Operation') }}</th>
                                <th class="py-2 pr-2 text-right font-medium">{{ t('Input') }}</th>
                                <th class="py-2 pr-2 text-right font-medium">{{ t('Output') }}</th>
                                <th class="py-2 pr-2 text-right font-medium">{{ t('Cached') }}</th>
                                <th class="py-2 pr-2 text-right font-medium">{{ t('Per call') }}</th>
                                <th class="py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            <PriceRowEditor
                                v-for="(price, index) in prices"
                                :key="index"
                                :price="price"
                                :index="index"
                                :locale="locale"
                                :id-prefix="idPrefix"
                                :known-models="knownModels"
                                :known-tools="knownTools"
                                @change="updateRow(index, $event)"
                                @remove="removeRow(index)"
                            />
                            <tr v-if="prices.length === 0">
                                <td colspan="9" class="py-3 text-sm text-muted-foreground">
                                    {{ t('No prices yet.') }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="saving"
                        data-testid="usage-prices-save"
                        @click="save"
                    >
                        {{ saving ? t('Saving…') : t('Save prices') }}
                    </button>
                    <span
                        v-if="saved"
                        class="text-sm text-muted-foreground"
                        data-testid="usage-prices-saved"
                    >
                        {{ t('Prices saved.') }}
                    </span>
                    <span
                        v-if="saveError"
                        class="text-sm text-destructive"
                        data-testid="usage-prices-save-error"
                    >
                        {{ saveError }}
                    </span>
                </div>
            </section>

            <section class="flex flex-col gap-3">
                <h3 class="text-sm font-semibold">{{ t('Unpriced') }}</h3>
                <p class="text-sm text-muted-foreground">
                    {{ t('These were used and cost nothing, because they have no price. Give them one to start charging.') }}
                </p>

                <div
                    v-if="unpriced.models.length === 0 && unpriced.tools.length === 0"
                    class="rounded-lg border border-border p-4 text-sm text-muted-foreground"
                    data-testid="usage-unpriced-empty"
                >
                    {{ t('Everything that was used has a price.') }}
                </div>

                <template v-else>
                    <div v-if="unpriced.models.length > 0" class="overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead>
                                <tr class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                    <th class="py-2 pr-3 font-medium">{{ t('Model') }}</th>
                                    <th class="py-2 pr-3 font-medium">{{ t('Provider') }}</th>
                                    <th class="py-2 pr-3 text-right font-medium">{{ t('Calls') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="(model, index) in unpriced.models"
                                    :key="`${model.provider}-${model.model}-${index}`"
                                    class="border-b border-border/60 last:border-0"
                                    :data-testid="`usage-unpriced-model-${index}`"
                                >
                                    <td class="py-2 pr-3 font-medium">{{ model.model }}</td>
                                    <td class="py-2 pr-3 text-muted-foreground">
                                        {{ model.provider === '' ? t('Any provider') : model.provider }}
                                    </td>
                                    <td class="py-2 pr-3 text-right">
                                        {{ formatTokens(model.calls, locale) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div v-if="unpriced.tools.length > 0" class="overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead>
                                <tr class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                    <th class="py-2 pr-3 font-medium">{{ t('Tool') }}</th>
                                    <th class="py-2 pr-3 font-medium">{{ t('Class') }}</th>
                                    <th class="py-2 pr-3 text-right font-medium">{{ t('Calls') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="(tool, index) in unpriced.tools"
                                    :key="`${tool.tool_class}-${index}`"
                                    class="border-b border-border/60 last:border-0"
                                    :data-testid="`usage-unpriced-tool-${index}`"
                                >
                                    <td class="py-2 pr-3 font-medium">{{ tool.tool_name }}</td>
                                    <td class="py-2 pr-3 font-mono text-xs text-muted-foreground">
                                        {{ tool.tool_class }}
                                    </td>
                                    <td class="py-2 pr-3 text-right">
                                        {{ formatTokens(tool.calls, locale) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </template>
            </section>
        </template>
    </div>
</template>
