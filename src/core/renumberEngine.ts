import type { TodoItem } from "../parser/todoParser";

export type RenumberEdit = {
  line: number;
  start: number;
  end: number;
  oldNumber: number;
  newNumber: number;
};

export function buildRenumberEdits(todos: readonly TodoItem[]): RenumberEdit[] {
  return buildRenumberEditsFrom(todos, 1, () => true);
}

export function buildRenumberEditsAfter(
  todos: readonly TodoItem[],
  afterLine: number,
  firstNumberAfterLine: number
): RenumberEdit[] {
  return buildRenumberEditsFrom(todos, firstNumberAfterLine, (todo) => todo.line > afterLine);
}

function buildRenumberEditsFrom(
  todos: readonly TodoItem[],
  initialNumber: number,
  shouldConsider: (todo: TodoItem) => boolean
): RenumberEdit[] {
  let nextNumber = initialNumber;
  const edits: RenumberEdit[] = [];

  for (const todo of [...todos].sort((left, right) => left.line - right.line || left.numberStart - right.numberStart)) {
    if (!shouldConsider(todo)) {
      continue;
    }

    if (todo.pinned) {
      continue;
    }

    if (todo.number !== nextNumber) {
      edits.push({
        line: todo.line,
        start: todo.numberStart,
        end: todo.numberEnd,
        oldNumber: todo.number,
        newNumber: nextNumber
      });
    }

    nextNumber += 1;
  }

  return edits;
}
