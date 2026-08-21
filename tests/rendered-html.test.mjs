import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the voting range app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /<title>투표 범위 분석 \| 최소·평균·최대 득표 예측<\/title>/i);
  assert.match(html, /VOTE SCOPE/);
  assert.match(html, /후보 설정/);
  assert.match(html, /명단 불러오기/);
  assert.match(html, /개인별 예상 선택/);
  assert.match(html, /예상 결과/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("calculates minimum, expected, maximum, score, and dense ties", async () => {
  const { calculateVoteResults } = await import("../app/vote-math.ts");
  const candidates = ["a", "b", "c", "d"].map((id) => ({ id }));
  const people = [
    { picks: ["a"] },
    { picks: ["a", "b"] },
    { picks: ["b", "c", "d"] },
    { picks: [] },
  ];

  const results = calculateVoteResults(candidates, people);
  const byId = new Map(results.map((result) => [result.id, result]));

  assert.deepEqual(
    {
      min: byId.get("a").min,
      expected: byId.get("a").expected,
      max: byId.get("a").max,
      score: byId.get("a").score,
      rank: byId.get("a").rank,
    },
    { min: 1, expected: 1.5, max: 2, score: 1.5, rank: 1 },
  );
  assert.equal(byId.get("b").rank, 2);
  assert.equal(byId.get("c").rank, 3);
  assert.equal(byId.get("d").rank, 3);
  assert.equal(byId.get("c").isTie, true);
  assert.equal(byId.get("d").isTie, true);
  assert.equal(
    results.reduce((sum, result) => sum + result.expected, 0),
    3,
  );
  results.forEach((result) => {
    assert.ok(result.min <= result.expected);
    assert.ok(result.expected <= result.max);
  });
});

test("removes starter-only assets and keeps the social preview", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /MAX_CANDIDATES/);
  assert.match(page, /addCandidate/);
  assert.match(page, /TXT 불러오기/);
  assert.match(layout, /투표 범위 분석/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
