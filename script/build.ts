import { es2022Lib } from "@cubing/dev-config/esbuild/es2022";
import { $ } from "bun";
import { build } from "esbuild";

await build({
  entryPoints: ["./src/index.ts"],
  outdir: "./dist/lib/lockfile-mutex/",
  ...es2022Lib(),
});

await $`bun x tsc --project ./tsconfig.build.json`;
