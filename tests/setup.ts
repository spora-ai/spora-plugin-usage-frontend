/**
 * Vitest global setup — installs the plugin's own i18n instance on every
 * mounted component.
 *
 * `en.json` is a generated identity map (`"Save": "Save"`), so `t('Save')`
 * renders the English source it was handed and the assertions on literal
 * UI copy keep passing unmodified. The *locale* is pinned to `en`, not the
 * instance's origin — the instance comes from `src/i18n` like the app's own
 * is — so a locale left behind on a developer's machine can never change
 * what the suite asserts.
 */
import { config } from '@vue/test-utils'
import { createPluginI18n } from '../src/i18n'

// Install vue-i18n on every mounted component, pinned to `en`.
//
// `en.json` is a generated identity map (`"Save": "Save"`), so `t('Save')`
// renders the English source it was handed and the assertions on literal
// UI copy keep passing unmodified. The *locale* is pinned to `en`, not the
// instance's origin — the instance comes from `src/i18n` like the app's own
// is — so a locale left behind on a developer's machine can never change
// what the suite asserts.
config.global.plugins = [createPluginI18n('en')]

