import * as assert from "node:assert/strict";
import { parseTodos } from "../../src/parser/todoParser";

suite("todoParser", () => {
  test("matches bare TODOs", () => {
    const [todo] = parseTodos("TODO #1: Set up auth");

    assert.equal(todo.line, 0);
    assert.equal(todo.number, 1);
    assert.equal(todo.numberStart, 6);
    assert.equal(todo.numberEnd, 7);
    assert.equal(todo.text, "Set up auth");
    assert.equal(todo.pinned, false);
  });

  test("matches supported comment styles", () => {
    const todos = parseTodos(
      [
        "// TODO #1: TypeScript",
        "# TODO #2: Shell",
        "<!-- TODO #3: HTML -->"
      ].join("\n")
    );

    assert.deepEqual(
      todos.map((todo) => [todo.line, todo.number, todo.text]),
      [
        [0, 1, "TypeScript"],
        [1, 2, "Shell"],
        [2, 3, "HTML"]
      ]
    );
  });

  test("captures pinned TODOs", () => {
    const [todo] = parseTodos("// TODO #99 [pin]: External tracker");

    assert.equal(todo.number, 99);
    assert.equal(todo.pinned, true);
    assert.equal(todo.text, "External tracker");
  });

  test("ignores malformed TODOs", () => {
    const todos = parseTodos(
      [
        "TODO #: missing number",
        "TODO #abc: invalid number",
        "TODO #1 missing colon",
        "TODO #2: valid"
      ].join("\n")
    );

    assert.equal(todos.length, 1);
    assert.equal(todos[0].number, 2);
  });

  test("returns items sorted by document position", () => {
    const todos = parseTodos("// TODO #3: Three\n\n// TODO #1: One");

    assert.deepEqual(
      todos.map((todo) => todo.line),
      [0, 2]
    );
  });
});
