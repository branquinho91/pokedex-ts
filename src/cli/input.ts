/**
 * O input() do Python, que o Node não tem: lê uma linha do terminal.
 *
 * Ctrl+C e Ctrl+D fecham a leitura e o input() lança InputClosedError
 * (o KeyboardInterrupt / EOFError do Python). Quem trata é o main.ts.
 */
import * as readline from "node:readline";

/** O usuário apertou Ctrl+C ou Ctrl+D: não tem mais o que ler. */
export class InputClosedError extends Error {
  constructor() {
    super("Input closed");
    this.name = "InputClosedError";
  }
}

let rl: readline.Interface | undefined;
let lines: AsyncIterator<string> | undefined;
let closed = false;

function open(): { rl: readline.Interface; lines: AsyncIterator<string> } {
  if (!rl || !lines) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Sem isso, o Ctrl+C só pausa o readline e o programa fica parado
    rl.on("SIGINT", () => rl?.close());
    rl.on("close", () => (closed = true));
    // O iterador guarda as linhas que chegam enquanto ninguém está perguntando
    // (ex.: entrada colada ou vinda de um pipe, enquanto a API responde)
    lines = rl[Symbol.asyncIterator]();
  }
  return { rl, lines };
}

export async function input(prompt = ""): Promise<string> {
  const { rl, lines } = open();
  if (closed) {
    // A entrada acabou (fim do pipe), mas ainda pode ter linhas guardadas
    process.stdout.write(prompt);
  } else {
    rl.setPrompt(prompt);
    rl.prompt();
  }
  const { value, done } = await lines.next();
  if (done) {
    throw new InputClosedError();
  }
  return value;
}

/** Libera o terminal para o processo poder terminar. */
export function closeInput(): void {
  rl?.close();
}
