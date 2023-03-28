import esbuild from "esbuild";
import { readFile } from "fs/promises";
import path from "path";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  format: "iife",
  bundle: true,
  legalComments: "external",
  define: {
    global: "self",
    "import.meta": "true",
  },
  plugins: [
    {
      name: "base64",
      setup(build) {
        build.onResolve({ filter: /\?base64$/ }, (args) => {
          return {
            path: args.path,
            pluginData: {
              isAbsolute: path.isAbsolute(args.path),
              resolveDir: args.resolveDir,
            },
            namespace: "base64-loader",
          };
        });
        build.onLoad(
          { filter: /\?base64$/, namespace: "base64-loader" },
          async (args) => {
            const fullPath = args.pluginData.isAbsolute
              ? args.path
              : path.join(args.pluginData.resolveDir, args.path);
            return {
              contents: Buffer.from(
                await readFile(fullPath.replace(/\?base64$/, ""))
              ).toString("base64"),
              loader: "text",
            };
          }
        );
      },
    },
  ],
  external: ["fs"],
  inject: ["./polyfill.js"],
});

export {};
