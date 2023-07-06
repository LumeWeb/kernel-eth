// @ts-nocheck
import * as import0 from "@rollup/plugin-json";
import * as import1 from "@rollup/plugin-node-resolve";
import * as import2 from "@rollup/plugin-commonjs";
import * as import3 from "@rollup/plugin-graphql";
import * as import4 from "@rollup/plugin-image";
import * as import5 from "@rollup/plugin-yaml";
import * as import6 from "rollup-plugin-postcss";
import * as import7 from "rollup-plugin-visualizer";
import * as import8 from "@rollup/plugin-wasm";
import * as import9 from "@rollup/plugin-alias";
import * as import10 from "rollup-plugin-ignore-import";

const customResolver = import1.default({
  extensions: [".js"],
  browser: true,
  preferBuiltins: false,
});

export default {
  input: "build/index.js",
  output: [
    {
      file: "lib/index.js",
      format: "cjs",
      sourcemap: true,
      inlineDynamicImports: true,
    },
  ],
  plugins: [
    import0.default(...([] as const)),
    import9.default({
      entries: {
        stream: "./nop.js",
      },
    }),
    import10.default({
      include: [
        "**/blst-native/index.js",
        "**/node-fetch/**",
        "**/micro-ftch/**",
      ],
      exclude: [],
    }),
    import1.default(
      ...([
        {
          browser: true,
          preferBuiltins: false,
          dedupe: [
            "@lumeweb/libkernel",
            "@lumeweb/libweb",
            "@lumeweb/libportal",
          ],
        },
      ] as const),
    ),
    import2.default(
      ...([{ extensions: [".js", ".jsx", ".ts", ".tsx"] }] as const),
    ),
    import10.default({
      include: [/.*commonjs-external/],
      exclude: [],
    }),
    import3.default(...([] as const)),
    import4.default(...([] as const)),
    import5.default(...([] as const)),
    import6.default(...([{ inject: { insertAt: "top" } }] as const)),
    import7.visualizer(...([] as const)),
    import8.default(...([{ targetEnv: "auto-inline" }] as const)),
  ],
};
