import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * Vite config for the Usage IIFE bundle.
 *
 * Three things matter here:
 *
 *  1. `build.lib.formats: ['iife']` produces a single self-contained script
 *     that the host SPA can dynamic `import()`. ES modules / UMD would break
 *     the IIFE semantics the host registry expects.
 *  2. `build.lib.name: 'SporaAppUsage'` matches `registry.ts → globalFor()` in
 *     `spora-frontend`. The IIFE wrapper exposes the named export on
 *     `window.<name>`. PascalCase of the slug (`usage`) is the convention —
 *     do not use kebab-case here.
 *  3. `build.rollupOptions.external: ['vue', 'pinia']` keeps Vue and Pinia
 *     out of the bundle so the host SPA's instances are shared. Sharing
 *     Pinia is what lets the plugin read auth state; sharing Vue is what
 *     prevents the slot from re-creating a second app instance.
 *
 * `build.outDir: 'frontend'` writes `main.js` + `style.css` directly into
 * this repo's `frontend/` directory (one level up from `src/`) — that is the
 * directory `SporaPluginFrontendInstaller` copies into `public/plugins/usage/`.
 */
export default defineConfig({
    plugins: [vue()],

    // `process.env.NODE_ENV` has to be replaced at build time. Vite
    // replaces it for an *app* build, but not for a **library** build — and
    // this is a library build (`build.lib.formats: ['iife']`). Without the
    // replacement the `process` identifier survives into the bundle and the
    // panel dies on load with "process is not defined".
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    // The slug here mirrors the PHP app's `UsageApp::name()` — they are a
    // coupled pair, not derivable from package metadata. The build output is
    // unaffected: the IIFE lib emits a single self-contained `main.js`.
    base: '/plugins/usage/',
    build: {
        // Write the IIFE bundle into `frontend/`. `SporaPluginFrontendInstaller`
        // copies the package's `frontend/` directory verbatim into
        // `public/plugins/<slug>/` at install time, so the build output MUST
        // live there.
        outDir: 'frontend',
        emptyOutDir: false,
        lib: {
            entry: 'src/main.ts',
            formats: ['iife'],
            name: 'SporaAppUsage',
            fileName: () => 'main.js',
        },
        rollupOptions: {
            external: ['vue', 'pinia'],
            output: {
                // `extend` must stay at its default. The host loads this
                // bundle via dynamic `import()` (module scope, top-level
                // `this` is `undefined`); `extend: true` would emit
                // `this.<name> = ...` and throw at load.
                globals: {
                    vue: 'window.Vue',
                    pinia: 'window.Pinia',
                },
                assetFileNames: (asset) => {
                    if (asset.name && asset.name.endsWith('.css')) {
                        return 'style.css'
                    }
                    return asset.name ?? '[name][extname]'
                },
            },
        },
    },
    server: {
        port: 5196,
        strictPort: false,
        cors: true,
    },
    test: {
        environment: 'happy-dom',
        globals: true,
        // Exclude git worktrees that may sit alongside this checkout.
        exclude: ['node_modules', 'dist', '.git/**', '.worktrees/**', '.wt/**'],
        setupFiles: ['./tests/setup.ts'],
        // Emit `coverage/lcov.info` so SonarCloud can read it.
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'clover', 'json'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,vue}'],
            exclude: ['src/dev-main.ts'],
        },
    },
})
