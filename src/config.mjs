export function configuration(inputs = {}, env = process.env) {
  const config = {
    repository: env.GITHUB_REPOSITORY,
    eventName: env.GITHUB_EVENT_NAME,
    runId: env.GITHUB_RUN_ID,
    server: env.GITHUB_SERVER_URL ?? "https://github.com",
    baseBranch: inputs["base-branch"] || "main",
    ciWorkflow: inputs["ci-workflow"] || "ci.yml",
    reviewWorkflow: inputs["review-workflow"] || "upkeep-review.yml",
    retryWorkflow: inputs["retry-workflow"] || "upkeep-retry.yml",
    appSlug: inputs["app-slug"],
    legacyAuthor: inputs["legacy-comment-author"] || "",
    notify: inputs["notification-target"] || "",
    sanityCommand: inputs["sanity-command"] || "npm run typecheck",
  };
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repository ?? ""))
    throw new Error("Missing or invalid repository");
  if (!/^[a-z0-9-]+$/.test(config.appSlug ?? "")) throw new Error("Missing or invalid App slug");
  if (!/^[\w./-]+$/.test(config.baseBranch)) throw new Error("Unsupported base branch");
  if (config.notify && !/^@?[\w-]+(?:\/[\w-]+)?$/.test(config.notify))
    throw new Error("Invalid notification target");
  // This command is supplied by a trusted workflow author, not a PR. Keep it one simple
  // npm script invocation so it can safely be inserted into Claude's allowedTools argument.
  if (!/^npm run [a-zA-Z0-9:_-]+$/.test(config.sanityCommand))
    throw new Error("sanity-command must be npm run <script>");
  for (const key of ["ciWorkflow", "reviewWorkflow", "retryWorkflow"]) {
    if (!/^[\w.-]+\.ya?ml$/.test(config[key])) throw new Error(`Invalid ${key} filename`);
  }
  return config;
}
