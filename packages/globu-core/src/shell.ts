export type SimpleCommand = { words: string[]; writes: string[] };

type Pending = "write" | "skip" | null;
type State = { commands: SimpleCommand[]; current: SimpleCommand; word: string | null; pending: Pending };

const HEREDOC_RE = /<<-?\s*(['"]?)(\w+)\1([^\n]*)\n(?:[\s\S]*?\n)?[ \t]*\2(?=\n|$)/g;
const FD_RE = /^\d*$/;

function endWord(state: State): void {
  if (state.word !== null) {
    if (state.pending === "write") state.current.writes.push(state.word);
    else if (state.pending === null) state.current.words.push(state.word);
    state.pending = null;
  }
  state.word = null;
}

function endCommand(state: State): void {
  endWord(state);
  if (state.current.words.length > 0 || state.current.writes.length > 0) state.commands.push(state.current);
  state.current = { words: [], writes: [] };
  state.pending = null;
}

function append(state: State, text: string): void {
  state.word = (state.word ?? "") + text;
}

function redirect(state: State, text: string, at: number): number {
  if (state.word !== null && FD_RE.test(state.word)) state.word = null;
  endWord(state);
  let last = at;
  if (text[last + 1] === ">" || text[last + 1] === "|") last++;
  if (text[last + 1] === "&") {
    state.pending = "skip";
    return last + 1;
  }
  state.pending = "write";
  return last;
}

function quoted(state: State, text: string, at: number): number {
  append(state, "");
  let index = at + 1;
  for (; index < text.length && text[index] !== '"'; index++) {
    if (text[index] === "\\" && index + 1 < text.length) index++;
    append(state, text[index]);
  }
  return index;
}

function until(text: string, mark: string, from: number): number {
  const end = text.indexOf(mark, from);
  return end === -1 ? text.length : end;
}

export function parseCommands(source: string): SimpleCommand[] {
  const text = source.replace(HEREDOC_RE, "$3");
  const state: State = { commands: [], current: { words: [], writes: [] }, word: null, pending: null };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "'") {
      const close = until(text, "'", index + 1);
      append(state, text.slice(index + 1, close));
      index = close;
    } else if (char === '"') {
      index = quoted(state, text, index);
    } else if (char === "\\") {
      append(state, text.slice(index + 1, index + 2));
      index++;
    } else if (char === " " || char === "\t") {
      endWord(state);
    } else if (char === "#" && state.word === null) {
      index = until(text, "\n", index) - 1;
    } else if (char === ">") {
      index = redirect(state, text, index);
    } else if (char === "&" && next === ">") {
      index = redirect(state, text, index + 1);
    } else if (char === "<") {
      endWord(state);
      state.pending = "skip";
    } else if (char === "|" || char === "&") {
      endCommand(state);
      if (next === char || next === "&") index++;
    } else if (char === ";" || char === "\n" || char === "(" || char === ")" || char === "`") {
      endCommand(state);
    } else if (char === "$" && next === "(") {
      endCommand(state);
      index++;
    } else {
      append(state, char);
    }
  }
  endCommand(state);
  return state.commands;
}
