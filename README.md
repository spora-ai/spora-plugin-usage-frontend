# spora-plugin-usage-frontend

Pre-built Vue SPA for the Spora **Usage** app. Delivered as a Composer package of type `spora-plugin-frontend`; `spora-installer`'s `SporaPluginFrontendInstaller` copies this repo's `frontend/` directory into `public/plugins/usage/` so the host SPA can lazy-load it via `/plugins/usage/main.js`. The directory name comes from this package's `composer.json#extra.spora-plugin-slug` (`usage`), which must equal the parent plugin's `plugin.json#slug` — there is no fallback to the package name, which is why the installer must be **v1.4.0 or newer**: that is the release that reads the slug, and before it the bundle landed in a directory the host SPA does not look in.

## Why a separate repo from the PHP plugin?

- The Vue bundle has its own release cadence (visual fixes don't need a PHP tag).
- Backend-only operators can `composer require spora-ai/spora-plugin-usage` without pulling in npm-buildable assets.
- The bundle is independently testable in isolation (Vitest + the smoke script).

## The four tabs, and the scope above them

| Tab | Who | What it shows |
| --- | --- | --- |
| **Overview** | everyone | The caller's own principals: the credit balance, the limits with what is left of each window, and the spend over time. |
| **Limits** | admin | The scoped principal's limit rows — the window, the unit, the cap, the mode, whether it is on — and the spend-to-date in each window. Editable. |
| **Budget** | admin | The scoped principal's credit balance and a grant form. |
| **Prices** | admin | The price book, and the unpriced models and tools. |

**The scope is a dropdown beside the tabs**, and it is what the Limits and Budget tabs are about. It lists every principal on the installation with its balance and its 30-day spend, so the scope is visible from every tab — never hidden behind a trip to another one.

The dropdown is an **admin** control, because the tabs it scopes are admin tabs. A caller who cannot configure anything is not offered a dropdown that scopes nothing.

**The API is the gate.** The admin tabs hide themselves for a non-admin, but that is a courtesy: every admin route carries the admin middleware, and a 403 on an admin call sets the app's `adminDenied` flag, which hides the admin tabs and returns to Overview. A 403 is not retried.

**A limit with no cap is a row that does not exist.** The editor adds and removes rows; there is no "cleared cap" state, because the backend's `cap` column is `NOT NULL` and a null would be a malformed request.

**The price book offers what the installation knows.** The model and the tool of a price row are dropdowns, listing the models and the tools the install has used. Picking a model brings its provider with it, because the pair is the book's key. The free-text field stays beside the dropdown — a price for a model the installation has never used still has to be enterable.

## The API

Every request goes through the host's typed client (`hostContext.api`), so CSRF, the base URL and the envelope unwrap are handled centrally. The paths live in one module (`src/lib/usage-api.ts`) so a change to the contract's base path is one edit rather than one per tab.

| Call | Path |
| --- | --- |
| `GET` | `/usage/me` |
| `GET` | `/usage/me/series?window=day\|week\|month` |
| `GET` | `/usage/principals` |
| `GET` | `/usage/principals/{id}` |
| `PUT` | `/usage/principals/{id}/limits` |
| `PUT` | `/usage/principals/{id}/credits` |
| `GET` | `/usage/prices` |
| `PUT` | `/usage/prices` |
| `GET` | `/usage/unpriced` |

**Per-token prices are unreadable.** The wire carries credits per token (`0.000002`). The price book shows credits **per million tokens** with the exact per-token value in the row's `title`, and the column header says so.

## Tailwind and the transform defaults

The bundle omits Tailwind's preflight, because the host owns the document-level resets. Two consequences:

- Every generated utility is scoped beneath `#spora-plugin-usage` (`tailwind.config.ts` → `important`), so the plugin's classes cannot override the host SPA or another plugin.
- Tailwind v3 defines the `--tw-translate-x`, `--tw-rotate` and `--tw-scale-x` variables in the same base rule as the preflight — which this bundle omits. With the variables missing, the `transform` declaration is invalid at computed-value time and the element keeps `transform: none`, so the utility **silently does nothing**: an icon meant to be centred sits half a line off. Centring and off-canvas placement therefore use `inset-y-0 my-auto` and `left`, not `translate-*`.

The theme colours (`--primary`, `--foreground`, `--card`, …) live on `:root` and `.dark` in the host's compiled CSS, and the host's theme switching cascades into the plugin for free.

## Build

```bash
npm ci
npm run build     # vue-tsc --noEmit && vite build → frontend/main.js + frontend/style.css
npm run smoke     # asserts the IIFE bundle registers window.SporaAppUsage
```

The build writes into `frontend/`, which is what the installer copies. `npm run clean` removes the artifacts.

`npm run smoke` is the runtime contract in one script: the bundle must declare `window.SporaAppUsage` (not `this.SporaAppUsage=`, which throws under the host's dynamic `import()`), it must define `mount(a, b)` and `unmount(a)`, the stylesheet must scope its utilities beneath `#spora-plugin-usage`, and it must not carry the preflight reset.

## Dev mode (plugin author)

```bash
npm run dev
```

The sandbox at `index.html` mounts the app against an in-memory mock (`src/dev-mock.ts`), so the tabs work without the PHP plugin installed. The sandbox shows the **admin** view by default; `?admin=0` in the URL turns the admin flag off, which shows the non-admin view.

Against a host checkout, the host SPA proxies `/plugins/usage` to this server: start it with `SPORA_PLUGIN_DEV_PORTS=usage:5196 npm run dev` on the host. The proxy is not hard-coded — see [the local-development guide](https://docs.spora-ai.com/develop/plugins/local-development.html).

## Translations

`src/locales/en.json` is a **generated identity map** — `npm run i18n:extract` regenerates it from the source, so every key is the English source string. `src/locales/de.json` is hand-written and must carry every key the source produces, with no value identical to its key.

`npm run i18n:check` fails the build when the catalogue drifts or when an **operator-facing string sits outside `t()`** — in a `.vue` template *or* in a `.ts` module. The panel ships one language and an unwrapped string is a string the operator reads in English.

## Mount contract

The IIFE wrapper installs this on `window.SporaAppUsage`; the host's `apps/registry.ts` reads `window.SporaAppUsage.mount` and `unmount` and calls them when `/apps/usage` is mounted and unmounted.

The plugin installs a **local** Pinia for its own state — the open tab and the selected principal — so nothing lands in the host's stores. The host's own services (auth) are reached through the Pinia instance the host passes in `hostContext.pinia`.

**The host's auth store is read from a private field.** `src/lib/host-auth.ts` reads `pinia._s`, Pinia's internal store map, because the plugin cannot import the host's `useAuthStore` (separate bundles) and the host publishes no module for it. The host creates its auth store before it mounts the router — and so before any plugin mounts — so the store is there when the plugin asks; if it is not, the panel reads the caller as a non-admin and the admin tabs simply do not appear. The sibling `spora-plugin-social-frontend` reads the host's theme store the same way, so this is the family's established pattern; what would replace it is a host change that publishes the user on the plugin host context.

## License

MIT — see [LICENSE](LICENSE).
