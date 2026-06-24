import * as assert from "node:assert/strict";
import { buildRenumberEdits, buildRenumberEditsAfter } from "../../src/core/renumberEngine";
import type { TodoItem } from "../../src/parser/todoParser";

suite("renumberEngine", () => {
  test("returns no edits when already sequential", () => {
    assert.deepEqual(buildRenumberEdits([todo(0, 1), todo(1, 2), todo(2, 3)]), []);
  });

  test("emits edits for gaps", () => {
    assert.deepEqual(buildRenumberEdits([todo(0, 1), todo(1, 3), todo(2, 5)]), [
      edit(1, 3, 2),
      edit(2, 5, 3)
    ]);
  });

  test("emits edits for duplicate numbers", () => {
    assert.deepEqual(buildRenumberEdits([todo(0, 1), todo(1, 1), todo(2, 1)]), [
      edit(1, 1, 2),
      edit(2, 1, 3)
    ]);
  });

  test("skips pinned TODOs without consuming sequence numbers", () => {
    assert.deepEqual(buildRenumberEdits([todo(0, 1), todo(1, 99, true), todo(2, 5)]), [
      edit(2, 5, 2)
    ]);
  });

  test("renumbers only TODOs after a line when requested", () => {
    assert.deepEqual(buildRenumberEditsAfter([todo(0, 1), todo(1, 2), todo(2, 2), todo(3, 3)], 1, 3), [
      edit(2, 2, 3),
      edit(3, 3, 4)
    ]);
  });
});

function todo(line: number, number: number, pinned = false): TodoItem {
  return {
    line,
    numberStart: 9,
    numberEnd: 9 + String(number).length,
    fullMatchStart: 3,
    fullMatchEnd: 20,
    number,
    text: `Todo ${number}`,
    pinned
  };
}

function edit(line: number, oldNumber: number, newNumber: number) {
  return {
    line,
    start: 9,
    end: 9 + String(oldNumber).length,
    oldNumber,
    newNumber
  };
}
