import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
const execute = promisify(execFile);

export class GitHub {
  async request(path, { method = "GET", body } = {}) {
    const args = ["api", path, "--method", method];
    if (body !== undefined) args.push("--input", "-");
    // execFile has no input option; use stdin explicitly without shell interpolation.
    return new Promise((resolve, reject) => {
      const child = execFile("gh", args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
        if (error) return reject(error);
        try {
          resolve(stdout.trim() ? JSON.parse(stdout) : null);
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }
  async pages(path, key) {
    const all = [];
    for (let page = 1; ; page++) {
      const data = await this.request(
        `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      );
      const items = key ? data[key] : data;
      all.push(...items);
      if (items.length < 100) return all;
    }
  }
  async comments(repo, number) {
    return (await this.pages(`repos/${repo}/issues/${number}/comments`)).map((c) => ({
      id: c.node_id,
      body: c.body,
      author: { login: c.user?.login },
      createdAt: c.created_at,
    }));
  }
  async file(repo, name, sha) {
    const data = await this.request(
      `repos/${repo}/contents/${name}?ref=${encodeURIComponent(sha)}`,
    );
    return JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  }
}

export async function registryMetadata(name) {
  // Public npm metadata only. Do not inherit App/model credentials or a project .npmrc.
  const env = { PATH: process.env.PATH, HOME: tmpdir(), npm_config_ignore_scripts: "true" };
  const { stdout } = await execute(
    "npm",
    ["view", `${name}@latest`, "version", "peerDependencies", "--json"],
    { cwd: tmpdir(), env, maxBuffer: 4 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

export async function localHead() {
  const { stdout } = await execute("git", ["rev-parse", "HEAD"]);
  return stdout.trim();
}
