import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export function smokeRuntime() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "upkeep-runtime-"));
  try {
    const bundle = join(dir, "controller.cjs");
    copyFileSync(join(root, "actions/controller/dist/index.cjs"), bundle);
    copyFileSync(join(root, "tests/fixtures/pr.json"), join(dir, "pr.json"));
    writeFileSync(join(dir, "event.json"), JSON.stringify({ inputs: { pr_number: "12" } }));
    writeFileSync(
      join(dir, "gh"),
      `#!${process.execPath}\nconst fs=require('node:fs');const p=process.argv[3];if(p==='repos/example/project/pulls/12')process.stdout.write(fs.readFileSync(${JSON.stringify(join(dir, "pr.json"))}));else {console.error('unexpected API path',p);process.exit(1)}`,
    );
    chmodSync(join(dir, "gh"), 0o755);
    const env = {
      PATH: `${dir}:${dirname(process.execPath)}`,
      HOME: dir,
      GITHUB_REPOSITORY: "example/project",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_EVENT_PATH: join(dir, "event.json"),
      GITHUB_OUTPUT: join(dir, "output"),
      UPKEEP_CONFIG: JSON.stringify({ "app-slug": "upkeep-test" }),
    };
    execFileSync(process.execPath, [bundle, "preflight"], { cwd: dir, env });
    const outputs = readFileSync(join(dir, "output"), "utf8");
    if (
      !outputs.includes("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") ||
      !outputs.includes("pr_number")
    )
      throw new Error("Runtime did not emit trusted PR context");
    return outputs;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  smokeRuntime();
  console.log("Standalone controller smoke check passed");
}
