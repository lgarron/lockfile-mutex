import { expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { sleep } from "bun";
import { LockfileMutex } from "../src";
import { existingLockfileAgeSync } from "../src/LockfileMutex";

// TODO: `nodeCleanup()` doesn't run in these tests.

test(".lock()", async () => {
  await rm("./.temp/test/.lockfile1", { force: true });
  const lockfileMutex = new LockfileMutex("./.temp/test/.lockfile1");

  // Run through a few cycles.
  for (let i = 0; i < 3; i++) {
    expect(lockfileMutex.isLocked).toBe(false);
    expect(lockfileMutex.lock()).toBe(true);
    expect(lockfileMutex.lock()).toBe(true);

    expect(lockfileMutex.lock({ idempotent: false })).toBe(false);
    expect(lockfileMutex.isLocked).toBe(true);

    expect(() => lockfileMutex.unlock()).not.toThrow();
    expect(lockfileMutex.isLocked).toBe(false);
    expect(() => lockfileMutex.unlock()).not.toThrow();
    expect(() => lockfileMutex.unlock({ idempotent: false })).toThrow();
    sleep(i * 100);
  }
});

test(".locked()", async () => {
  await rm("./.temp/test/.lockfile2", { force: true });
  const { lockfileMutex, isLocked } = LockfileMutex.locked(
    "./.temp/test/.lockfile2",
    {},
  );
  expect(isLocked).toBe(true);
  expect(lockfileMutex.isLocked).toBe(true);
  lockfileMutex.unlock();
  expect(lockfileMutex.isLocked).toBe(false);
});

test("contention", async () => {
  await rm("./.temp/test/.lockfile3", { force: true });
  const lockfileMutex1 = new LockfileMutex("./.temp/test/.lockfile3", {
    timeoutMilliseconds: 100,
  });
  const lockfileMutex2 = new LockfileMutex("./.temp/test/.lockfile3", {
    timeoutMilliseconds: 100,
  });

  expect(lockfileMutex1.lock()).toBe(true);
  expect(lockfileMutex2.lock()).toBe(false);

  lockfileMutex1.unlock();
  await writeFile("./.temp/test/.lockfile3", "");
  expect(lockfileMutex2.lock()).toBe(false);
  await sleep(110);
  expect(lockfileMutex2.lock()).toBe(true);
  expect(lockfileMutex1.lock()).toBe(false);
});

test(".locked() → errorOnLockfileFailure", async () => {
  await rm("./.temp/test/.lockfile3", { force: true });
  expect(LockfileMutex.locked("./.temp/test/.lockfile4").isLocked).toBe(true);
  expect(() => LockfileMutex.locked("./.temp/test/.lockfile4")).toThrow();
  expect(
    LockfileMutex.locked("./.temp/test/.lockfile4", {
      errorOnLockFailure: false,
    }).isLocked,
  ).toBe(false);
});

test("short", async () => {
  await rm("./.temp/test/.lockfile4", { force: true });
  LockfileMutex.locked("./.temp/test/.lockfile5", {
    timeoutMilliseconds: 10,
  });
  await sleep(105);
  expect(existingLockfileAgeSync("./.temp/test/.lockfile5")).toBeLessThan(10);
});
