export const DEFAULT_TODO_PATTERN = String.raw`TODO\s+#(\d+)(\s+\[pin\])?:\s*(.*?)\s*(?:-->)?$`;

export type TodoItem = {
  line: number;
  numberStart: number;
  numberEnd: number;
  fullMatchStart: number;
  fullMatchEnd: number;
  number: number;
  text: string;
  pinned: boolean;
};

type Position = {
  line: number;
  character: number;
};

export function createTodoRegex(pattern = DEFAULT_TODO_PATTERN): RegExp {
  return new RegExp(pattern, "gm");
}

export function parseTodos(documentText: string, patternOrRegex: string | RegExp = DEFAULT_TODO_PATTERN): TodoItem[] {
  const regex = typeof patternOrRegex === "string" ? createTodoRegex(patternOrRegex) : cloneGlobalMultilineRegex(patternOrRegex);
  const lineStarts = buildLineStarts(documentText);
  const todos: TodoItem[] = [];

  regex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(documentText)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }

    const rawNumber = match[1];
    if (!rawNumber || !/^\d+$/.test(rawNumber)) {
      continue;
    }

    const numberRelativeStart = match[0].indexOf(rawNumber);
    if (numberRelativeStart < 0) {
      continue;
    }

    const numberOffset = match.index + numberRelativeStart;
    const numberPosition = positionAtOffset(lineStarts, numberOffset);
    const fullStartPosition = positionAtOffset(lineStarts, match.index);
    const fullEndPosition = positionAtOffset(lineStarts, match.index + match[0].length);
    const number = Number.parseInt(rawNumber, 10);

    if (!Number.isSafeInteger(number)) {
      continue;
    }

    todos.push({
      line: numberPosition.line,
      numberStart: numberPosition.character,
      numberEnd: numberPosition.character + rawNumber.length,
      fullMatchStart: fullStartPosition.character,
      fullMatchEnd: fullEndPosition.character,
      number,
      text: normalizeTodoText(match[3] ?? ""),
      pinned: Boolean(match[2])
    });
  }

  return todos.sort((left, right) => left.line - right.line || left.numberStart - right.numberStart);
}

function cloneGlobalMultilineRegex(regex: RegExp): RegExp {
  const flags = new Set(regex.flags.split(""));
  flags.add("g");
  flags.add("m");
  return new RegExp(regex.source, Array.from(flags).sort().join(""));
}

function normalizeTodoText(text: string): string {
  return text.replace(/\s*-->\s*$/, "").trimEnd();
}

function buildLineStarts(text: string): number[] {
  const starts = [0];

  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      starts.push(index + 1);
    }
  }

  return starts;
}

function positionAtOffset(lineStarts: number[], offset: number): Position {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const lineStart = lineStarts[middle];
    const nextLineStart = middle + 1 < lineStarts.length ? lineStarts[middle + 1] : Number.POSITIVE_INFINITY;

    if (offset < lineStart) {
      high = middle - 1;
    } else if (offset >= nextLineStart) {
      low = middle + 1;
    } else {
      return {
        line: middle,
        character: offset - lineStart
      };
    }
  }

  const lastLine = lineStarts.length - 1;
  return {
    line: lastLine,
    character: Math.max(0, offset - lineStarts[lastLine])
  };
}
