import { Command, CommanderError } from "commander";
import { z } from "zod";

export type Io = {
  out: (text: string) => void;
  err: (text: string) => void;
  stdin: () => string;
  cwd: string;
};
export type Program = { name: string; description: string; version: string };
export type Exit = (code: number) => void;
export type JsonOption = { json?: boolean };

const HookInputSchema = z.object({
  cwd: z.string().optional(),
  tool_input: z
    .object({ file_path: z.string().optional(), notebook_path: z.string().optional(), command: z.string().optional() })
    .default({})
});
export type HookInput = z.infer<typeof HookInputSchema>;

export function command(parent: Command, usage: string, description: string): Command {
  return parent.command(usage).description(description).option("--json", "print machine-readable JSON");
}

export function print(io: Io, json: boolean | undefined, value: unknown, text: string): void {
  io.out(json ? JSON.stringify(value, null, 2) : text);
}

export function readHookInput(io: Io): HookInput | null {
  try {
    return HookInputSchema.parse(JSON.parse(io.stdin()));
  } catch {
    return null;
  }
}

function withoutFinalNewline(text: string): string {
  return text.replace(/\n$/, "");
}

export function runCli(
  { name, description, version }: Program,
  define: (program: Command, exit: Exit) => void,
  argv: string[],
  io: Io
): number {
  let code = 0;
  const program = new Command(name)
    .description(description)
    .version(version)
    .exitOverride()
    .configureOutput({
      writeOut: (text) => io.out(withoutFinalNewline(text)),
      writeErr: (text) => io.err(withoutFinalNewline(text))
    });
  define(program, (value) => {
    code = value;
  });
  try {
    program.parse(argv, { from: "user" });
  } catch (err) {
    if (err instanceof CommanderError) return err.exitCode;
    io.err(`${name}: ${(err as Error).message}`);
    return 1;
  }
  return code;
}
