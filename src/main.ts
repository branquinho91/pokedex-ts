/** Ponto de entrada da Pokedex CLI: npm start */
import { closeInput, InputClosedError } from "./cli/input";
import { run } from "./cli/menu";

async function main(): Promise<void> {
  try {
    await run();
  } catch (err) {
    // Ctrl+C / Ctrl+D em qualquer input() sobe até aqui
    if (!(err instanceof InputClosedError)) throw err;
    console.log("\nBye!");
  } finally {
    closeInput();
  }
}

void main();
