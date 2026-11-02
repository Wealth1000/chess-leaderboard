import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * A failed gist read used to look like "no existing data" and the next write
 * replaced the whole history with one day. On a 403 rate limit that is data
 * loss, so every read failure must abort the run instead.
 */
const require = createRequire(import.meta.url);

type RequestResult = { status: number | null; json: unknown; body?: string };
type RequestOptions = { headers?: Record<string, string> };

const { fetchExistingSnapshots } = require("../scripts/fetch-ratings.js") as {
  fetchExistingSnapshots: (
    request?: (
      options: RequestOptions,
      label: string,
    ) => Promise<RequestResult>,
  ) => Promise<{ version: number | null; snapshots: unknown[] }>;
};

function request(result: RequestResult) {
  return async () => result;
}

function gistWith(content: string) {
  return {
    files: {
      "snapshots.json": { content },
    },
  };
}

describe("fetchExistingSnapshots", () => {
  it("reads the existing document and sends the token", async () => {
    let options: RequestOptions | undefined;
    const result = await fetchExistingSnapshots(async (requestOptions) => {
      options = requestOptions;
      return {
        status: 200,
        json: gistWith(
          JSON.stringify({
            version: 2,
            snapshots: [{ playerId: "wealth", date: "2026-11-01" }],
          }),
        ),
      };
    });

    expect(options?.headers?.Authorization).toMatch(/^token /);
    expect(result.version).toBe(2);
    expect(result.snapshots).toHaveLength(1);
  });

  it("refuses to continue when GitHub cannot be read", async () => {
    await expect(
      fetchExistingSnapshots(
        request({ status: 403, json: null, body: "rate limit exceeded" }),
      ),
    ).rejects.toThrow(/refusing to overwrite history/i);
  });

  it("refuses to continue when the snapshot file is missing", async () => {
    await expect(
      fetchExistingSnapshots(request({ status: 200, json: { files: {} } })),
    ).rejects.toThrow(/refusing to start fresh/i);
  });

  it("refuses to overwrite invalid JSON", async () => {
    await expect(
      fetchExistingSnapshots(
        request({ status: 200, json: gistWith("{not json") }),
      ),
    ).rejects.toThrow(/refusing to overwrite/i);
  });
});
