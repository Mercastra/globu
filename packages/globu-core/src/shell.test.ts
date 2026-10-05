import { describe, expect, it } from "vitest";
import { parseCommands } from "./shell.js";

function words(source: string): string[][] {
  return parseCommands(source).map((command) => command.words);
}

describe("parseCommands", () => {
  it("splits words and honours quotes and escapes", () => {
    expect(words(`echo "a b" 'c d' e\\ f "" "say \\"hi\\""`)).toEqual([["echo", "a b", "c d", "e f", "", 'say "hi"']]);
    expect(words("echo $HOME a#b")).toEqual([["echo", "$HOME", "a#b"]]);
    expect(words("echo 'open")).toEqual([["echo", "open"]]);
    expect(words('echo "open\\')).toEqual([["echo", "open\\"]]);
    expect(words("echo a\\")).toEqual([["echo", "a"]]);
  });

  it("splits commands at operators, substitutions and newlines", () => {
    expect(words("a && b || c; d | e |& f & g\nh")).toEqual([["a"], ["b"], ["c"], ["d"], ["e"], ["f"], ["g"], ["h"]]);
    expect(words("echo $(date) `pwd` (ls)")).toEqual([["echo"], ["date"], ["pwd"], ["ls"]]);
  });

  it("collects the files a command writes through redirects", () => {
    expect(parseCommands("echo x > out.txt 2>> err.log 2>&1 &> all.log >| force.txt < in.txt")).toEqual([
      { words: ["echo", "x"], writes: ["out.txt", "err.log", "all.log", "force.txt"] }
    ]);
    expect(parseCommands("echo a>b &>> c")).toEqual([{ words: ["echo", "a"], writes: ["b", "c"] }]);
    expect(parseCommands("> only.txt")).toEqual([{ words: [], writes: ["only.txt"] }]);
    expect(words('cat <<< "text" > /dev/null')).toEqual([["cat"]]);
  });

  it("ignores comments and heredoc bodies", () => {
    expect(words("# remove /x\nls # trailing\necho done # end")).toEqual([["ls"], ["echo", "done"]]);
    expect(parseCommands("cat > out.md <<'EOF' && echo done\nrm /etc/x\nEOF\nls")).toEqual([
      { words: ["cat"], writes: ["out.md"] },
      { words: ["echo", "done"], writes: [] },
      { words: ["ls"], writes: [] }
    ]);
    expect(words("cat <<-END\n\tbody\n\tEND")).toEqual([["cat"]]);
    expect(words("cat <<EOF\nEOF\nls")).toEqual([["cat"], ["ls"]]);
    expect(words("cat <<EOF\nbody")).toEqual([["cat"], ["body"]]);
  });
});
