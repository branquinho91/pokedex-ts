/**
 * Interface de linha de comando: todo input() e console.log() do app fica aqui.
 *
 * Não sabe montar URL nem ler JSON. Só conversa com o PokeAPIClient
 * e mostra o resultado. Qualquer PokedexError vira uma mensagem na tela.
 */
import type { Ability, Pokemon, PokemonPage } from "../models/pokemon";
import { PokedexError } from "../services/errors";
import { PokeAPIClient } from "../services/pokeapi";
import { input } from "./input";

/**
 * O que a CLI precisa de um cliente: só estes dois métodos.
 * Qualquer objeto com eles serve (nos testes, um cliente falso).
 */
export type PokedexApi = Pick<PokeAPIClient, "getPokemon" | "listPokemon">;

// Nome do stat na API -> rótulo da spec
const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Speed",
};

const LINE = "=".repeat(30);

/** Loop do menu principal. Só sai quando o usuário escolhe Exit. */
export async function run(api: PokedexApi = new PokeAPIClient()): Promise<void> {
  while (true) {
    console.log(`\n${LINE}\nPOKEDEX\n${LINE}`);
    console.log("1. Search Pokémon");
    console.log("2. List Pokémon");
    console.log("3. Exit");
    const choice = (await input("\nChoose an option: ")).trim();

    if (choice === "1") {
      await search(api);
    } else if (choice === "2") {
      await browse(api);
    } else if (choice === "3") {
      console.log("Bye!");
      return;
    } else {
      console.log("Invalid option. Type 1, 2 or 3.");
    }
  }
}

export async function search(api: PokedexApi): Promise<void> {
  const query = await input("Pokémon name or number: ");
  let pokemon: Pokemon;
  try {
    pokemon = await api.getPokemon(query);
  } catch (err) {
    if (!(err instanceof PokedexError)) throw err; // bug nosso: deixa estourar
    console.log(err.message); // a mensagem já foi escrita pensando no usuário
    return;
  }
  console.log(formatPokemon(pokemon));
}

/** Listagem paginada: busca uma página, mostra, pergunta para onde ir. */
export async function browse(api: PokedexApi, limit = 20): Promise<void> {
  let offset: number | null = 0;
  while (offset !== null) {
    let page: PokemonPage;
    try {
      page = await api.listPokemon(offset, limit);
    } catch (err) {
      if (!(err instanceof PokedexError)) throw err;
      console.log(err.message);
      return;
    }
    console.log(formatPage(page));

    offset = await askNavigation(page);
  }
}

/** Pergunta até receber um comando válido. Devolve o novo offset ou null (sair). */
async function askNavigation(page: PokemonPage): Promise<number | null> {
  while (true) {
    const command = (await input("> ")).trim().toLowerCase();
    if (command === "q") {
      return null;
    }
    if (command === "n") {
      if (page.hasNext) {
        return page.offset + page.limit;
      }
      console.log("This is the last page.");
    } else if (command === "p") {
      if (page.hasPrevious) {
        return page.offset - page.limit;
      }
      console.log("This is the first page.");
    } else {
      console.log("Type n, p or q.");
    }
  }
}

// --- Formatação: recebem objetos e devolvem texto (não imprimem) ---

export function formatPokemon(pokemon: Pokemon): string {
  const lines = [
    "",
    LINE,
    `#${String(pokemon.id).padStart(3, "0")} ${displayName(pokemon.name)}`,
    LINE,
    `${"Types:".padEnd(11)}${pokemon.types.map(displayName).join(", ")}`,
    // toFixed(1): 6 -> "6.0", como o Python mostrava
    `${"Height:".padEnd(11)}${pokemon.heightM.toFixed(1)} m`,
    `${"Weight:".padEnd(11)}${pokemon.weightKg.toFixed(1)} kg`,
    `${"Abilities:".padEnd(11)}${pokemon.abilities.map(formatAbility).join(", ")}`,
    "",
    "Stats",
  ];
  for (const stat of pokemon.stats) {
    const label = STAT_LABELS[stat.name] ?? displayName(stat.name);
    lines.push(`  ${label.padEnd(10)}${String(stat.value).padStart(4)}`);
  }
  return lines.join("\n");
}

export function formatPage(page: PokemonPage): string {
  const first = page.offset + 1;
  const last = page.offset + page.results.length;
  const lines = ["", `Showing Pokémon ${first}-${last} of ${page.total}`, ""];
  for (const summary of page.results) {
    lines.push(`${summary.id}. ${displayName(summary.name)}`);
  }
  lines.push("");
  if (page.hasNext) {
    lines.push("[n] Next page");
  }
  if (page.hasPrevious) {
    lines.push("[p] Previous page");
  }
  lines.push("[q] Quit");
  return lines.join("\n");
}

/** { name: "lightning-rod", isHidden: true } -> 'Lightning-Rod (hidden)' */
export function formatAbility(ability: Ability): string {
  const suffix = ability.isHidden ? " (hidden)" : "";
  return `${displayName(ability.name)}${suffix}`;
}

/** 'mr-mime' -> 'Mr-Mime' (mantém o hífen para dar para buscar de volta). */
export function displayName(name: string): string {
  // Igual ao str.title() do Python: maiúscula no começo e depois de qualquer não-letra
  return name.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, before, letter) => before + letter.toUpperCase());
}
