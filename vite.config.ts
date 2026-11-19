import { defineConfig } from "vite";
import angular from "@analogjs/vite-plugin-angular";
import tailwindcss from "@tailwindcss/vite";
import * as fs from "fs";
import * as path from "path";
import type { Plugin } from "vite";

// Required for SharedArrayBuffer support (needed by Horizon WASM threads)
const COOP_COEP_HEADERS = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "cross-origin",
};

/**
 * Dev server plugin: serve static files from additional directories at root.
 * Used to serve fonts/SVGs from the local resources/ folder and
 * Horizon WASM files from node_modules without duplicating them.
 * COOP/COEP headers are applied to every response so that SharedArrayBuffer
 * remains available inside Emscripten web workers loading these files.
 */
function serveExtraStatic(dirs: string[]): Plugin {
    return {
        name: "serve-extra-static",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const urlPath = req.url?.split("?")[0] ?? "/";
                if (urlPath === "/") return next();
                const relPath = urlPath.slice(1); // remove leading /
                for (const dir of dirs) {
                    const filePath = path.join(dir, relPath);
                    if (
                        fs.existsSync(filePath) &&
                        fs.statSync(filePath).isFile()
                    ) {
                        const ext = path.extname(filePath).toLowerCase();
                        const mimeTypes: Record<string, string> = {
                            ".wasm": "application/wasm",
                            ".js": "application/javascript",
                            ".ttf": "font/ttf",
                            ".woff2": "font/woff2",
                            ".svg": "image/svg+xml",
                            ".txt": "text/plain",
                            ".png": "image/png",
                        };
                        if (mimeTypes[ext]) {
                            res.setHeader("Content-Type", mimeTypes[ext]);
                        }
                        res.setHeader("Cache-Control", "no-store");
                        for (const [key, value] of Object.entries(
                            COOP_COEP_HEADERS,
                        )) {
                            res.setHeader(key, value);
                        }
                        fs.createReadStream(filePath).pipe(
                            res as NodeJS.WritableStream,
                        );
                        return;
                    }
                }
                next();
            });
        },
    };
}

/**
 * Build plugin: copy the vendored static files to the dist ROOT, exactly where
 * the app expects them at runtime — resources/ assets (fonts, svg, logos) and the
 * Horizon WASM runtime, which the engine worker fetches from `runtimeFilesBaseUrl`
 * (see HrzCoreBackend.init). Mirrors what serveExtraStatic() serves in dev.
 * NB: vite-plugin-static-copy v4 preserves the source dir structure, which would
 * nest these under dist/resources/ and dist/node_modules/… — hence this flat copy.
 */
function copyRuntimeFiles(): Plugin {
    let outRoot = "dist";
    return {
        name: "copy-runtime-files",
        apply: "build",
        configResolved(config) {
            outRoot = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
            // resources/* -> dist root
            fs.cpSync(path.resolve(__dirname, "resources"), outRoot, {
                recursive: true,
            });
            // Horizon WASM runtime -> dist root
            const hrzDir = path.resolve(
                __dirname,
                "node_modules/@siradel-oss/horizon-core/dist",
            );
            for (const f of ["hrz_core.js", "hrz_core.wasm"]) {
                fs.copyFileSync(path.join(hrzDir, f), path.join(outRoot, f));
            }
        },
    };
}

export default defineConfig({
    // Relative asset URLs: the same build runs at a domain root or under a
    // subpath (oss.siradel.com/<repository>/, private Pages domain…).
    base: "./",
    plugins: [
        tailwindcss(),
        // Compiles real Angular components (latest), keeping the Vite toolchain
        // so the COOP/COEP + runtime WASM serving below stay intact.
        angular({ tsconfig: path.resolve(__dirname, "tsconfig.app.json") }),
        // Serve shared resources and WASM files during dev
        serveExtraStatic([
            path.resolve(__dirname, "resources"),
            path.resolve(
                __dirname,
                "node_modules/@siradel-oss/horizon-core/dist",
            ),
        ]),
        // Copy resources/ + Horizon WASM runtime to the dist root during build.
        copyRuntimeFiles(),
    ],
    server: {
        headers: COOP_COEP_HEADERS,
    },
    preview: {
        headers: COOP_COEP_HEADERS,
    },
});
