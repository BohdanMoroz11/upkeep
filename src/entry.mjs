import { appendFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { configuration } from "./config.mjs";
import { createController } from "./controller.mjs";
import { GitHub, localHead, registryMetadata } from "./github.mjs";

export function writeOutput(key, value, file = process.env.GITHUB_OUTPUT) {
  if (!/^[a-z_]+$/.test(key)) throw new Error("Invalid output name");
  if (!file) return;
  const delimiter = `upkeep_${randomUUID()}`;
  appendFileSync(file, `${key}<<${delimiter}\n${String(value)}\n${delimiter}\n`);
}

export async function main() {
  const inputs = JSON.parse(process.env.UPKEEP_CONFIG ?? process.env.INPUT_CONFIG ?? "{}");
  const config = configuration(inputs);
  const controller = createController({
    github: new GitHub(),
    registry: registryMetadata,
    localHead,
    config,
    output: writeOutput,
  });
  const operation = process.argv[2] ?? process.env.INPUT_OPERATION;
  const event = () => JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const n = process.env.UPKEEP_PR ?? process.env.INPUT_PR;
  const sha = process.env.UPKEEP_SHA ?? process.env.INPUT_SHA;
  const branch = process.env.UPKEEP_BRANCH ?? process.env.INPUT_BRANCH;
  switch (operation) {
    case "preflight":
      return controller.preflight(event());
    case "retry-gate":
      return controller.retryGate(event());
    case "verify-head":
      return controller.verifyHead(n, sha, branch);
    case "prepare-agent":
      return controller.prepareAgent(
        n,
        sha,
        branch,
        process.env.UPKEEP_KIND,
        process.env.UPKEEP_CI_RUN_ID,
      );
    case "verify-review":
      return controller.verifyReview(n, process.env.UPKEEP_STARTED_AT);
    case "verify-retry":
      return controller.verifyRetry(n, process.env.UPKEEP_CI_RUN_ID, sha);
    case "watchdog":
      return controller.watchdog();
    case "report-failure":
      return controller.reportFailure(n, process.env.UPKEEP_KIND);
    default:
      throw new Error(`Unknown controller operation: ${operation}`);
  }
}

main().catch((error) => {
  console.error(`::error::${error.message.replaceAll("\n", "%0A")}`);
  process.exitCode = 1;
});
