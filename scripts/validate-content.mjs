import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const kit = new URL(
  "../src/Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/",
  import.meta.url,
);
const load = async (name) =>
  JSON.parse(await readFile(new URL(`data/${name}.json`, kit), "utf8"));
const [grades, hours, checkpoints, poses, manifest] = await Promise.all(
  ["grades", "hours", "checkpoints", "poses", "asset-manifest"].map(load),
);
for (const [items, count] of [
  [grades, 10],
  [hours, 100],
  [checkpoints, 1200],
  [poses, 30],
]) {
  assert.equal(items.length, count);
  assert.equal(new Set(items.map((i) => i.id)).size, count);
}
for (const g of grades) {
  assert.equal(hours.filter((h) => h.gradeId === g.id).length, 10);
  assert.equal(checkpoints.filter((c) => c.gradeId === g.id).length, 120);
  assert.equal(g.poseIds.length, 3);
  assert(
    g.hourIds.every((id) =>
      hours.some((h) => h.id === id && h.gradeId === g.id),
    ),
  );
}
for (const h of hours) {
  assert.equal(h.checkpointIds.length, 12);
  assert(poses.some((p) => p.id === h.poseId));
  h.checkpointIds.forEach((id, i) => {
    const c = checkpoints.find((c) => c.id === id);
    assert(c && c.hourId === h.id && c.gradeId === h.gradeId);
    assert.equal(c.offsetMinutes, h.offsetMinutes + i * 5);
    assert(poses.some((p) => p.id === c.poseId));
    assert([0, 60, 120].includes(c.trialWindowSeconds));
    assert.equal(c.autoComplete, false);
    if (c.trialWindowSeconds) assert(c.requiresExplicitStart);
    if (Number(c.gradeId.slice(1)) >= 9 || h.number === 10)
      assert.equal(c.trialWindowSeconds, 0);
  });
}
assert.equal(manifest.poseAssets.length, 30);
const cells = new Set();
for (const p of poses) {
  const mapping = manifest.poseAssets.find((a) => a.id === p.assetId);
  assert(mapping, `Missing artwork for ${p.id}`);
  const { id, ...asset } = mapping;
  assert.deepEqual(p.asset, asset);
  assert.equal(asset.columns, 3);
  assert.equal(asset.rows, 2);
  assert(
    asset.column >= 0 && asset.column < 3 && asset.row >= 0 && asset.row < 2,
  );
  const cell = `${asset.atlas}:${asset.column}:${asset.row}`;
  assert(!cells.has(cell));
  cells.add(cell);
  assert(manifest.atlases.some((a) => a.path === asset.atlas));
}
for (const a of manifest.atlases) {
  const bytes = await readFile(new URL(`../public${a.path}`, import.meta.url));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    a.sha256,
    `Hash mismatch: ${a.path}`,
  );
  assert.equal(bytes.readUInt32BE(16), a.width);
  assert.equal(bytes.readUInt32BE(20), a.height);
  assert.equal(a.width / 3, a.height / 2);
}
console.log(
  "Validated 10 grades, 100 hours, 1,200 checkpoints, 30 unique pose cells and 5 PNG hashes.",
);
