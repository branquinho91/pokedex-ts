/** CLI: formatação (funções puras) e fluxos com input simulado e cliente falso. */
import { beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { input } from "../src/cli/input";
import { browse, displayName, formatPage, formatPokemon, type PokedexApi, run, search } from "../src/cli/menu";
import { pokemonFromApi } from "../src/mappers/pokeapi";
import type { Pokemon, PokemonPage } from "../src/models/pokemon";
import { APIUnavailableError, PokemonNotFoundError } from "../src/services/errors";
import { pikachuJson } from "./fixtures";

// Troca o módulo inteiro por um mock: nenhum teste lê o terminal de verdade
vi.mock("../src/cli/input", () => ({ input: vi.fn() }));

/**
 * Finge ser o PokeAPIClient: mesmos métodos, sem internet.
 * Tem 3 páginas de 2 Pokémon cada (total 6).
 */
class FakeClient implements PokedexApi {
  offsetsPedidos: number[] = [];

  constructor(
    private readonly pokemon?: Pokemon,
    private readonly error?: Error,
  ) {}

  async getPokemon(): Promise<Pokemon> {
    if (this.error) throw this.error;
    return this.pokemon!;
  }

  async listPokemon(offset = 0, limit = 20): Promise<PokemonPage> {
    if (this.error) throw this.error;
    this.offsetsPedidos.push(offset);
    const ids = [];
    for (let i = offset + 1; i <= Math.min(offset + limit, 6); i++) ids.push(i);
    return {
      results: ids.map((i) => ({ id: i, name: `poke${i}` })),
      total: 6,
      offset,
      limit,
      hasNext: offset + limit < 6,
      hasPrevious: offset > 0,
    };
  }
}

/** Simula o usuário digitando: typing("1", "pikachu", "3"). */
function typing(...answers: string[]): void {
  const mock = vi.mocked(input);
  mock.mockReset();
  for (const answer of answers) mock.mockResolvedValueOnce(answer);
}

let log: MockInstance;

/** Tudo que foi impresso com console.log, como um texto só. */
function output(): string {
  return log.mock.calls.map((args) => args.join(" ")).join("\n");
}

beforeEach(() => {
  // Captura o console.log (o capsys do pytest) e não deixa sujar a saída dos testes
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});

const pikachu = (): Pokemon => pokemonFromApi(pikachuJson());

// --- Formatação: recebem objeto, devolvem texto ---

describe("formatação", () => {
  it("formatPokemon", () => {
    const text = formatPokemon(pikachu());
    expect(text).toContain("#025 Pikachu");
    expect(text).toContain("Types:     Electric");
    expect(text).toContain("Height:    0.4 m");
    expect(text).toContain("Weight:    6.0 kg");
    expect(text).toContain("Abilities: Static, Lightning-Rod (hidden)");
  });

  it("stats com rótulos da spec e alinhados", () => {
    const lines = formatPokemon(pikachu()).split("\n");
    const stats = lines.slice(lines.indexOf("Stats") + 1);
    expect(stats.map((line) => line.trim().split(/\s+/)[0])).toEqual(["HP", "Attack", "Defense", "Sp.", "Sp.", "Speed"]);
    expect(stats[0]).toBe("  HP          35");
    expect(new Set(stats.map((line) => line.length)).size).toBe(1); // todas do mesmo tamanho = alinhadas
  });

  it("formatPage primeira página", async () => {
    const text = formatPage(await new FakeClient().listPokemon(0, 2));
    expect(text).toContain("Showing Pokémon 1-2 of 6");
    expect(text).toContain("1. Poke1");
    expect(text).toContain("[n] Next page");
    expect(text).not.toContain("[p] Previous page"); // não tem anterior
    expect(text).toContain("[q] Quit");
  });

  it.each([
    ["mr-mime", "Mr-Mime"],
    ["porygon-z", "Porygon-Z"],
    ["porygon2", "Porygon2"],
    ["PIKACHU", "Pikachu"],
  ])("displayName('%s') = '%s', igual ao str.title() do Python", (name, expected) => {
    expect(displayName(name)).toBe(expected);
  });
});

// --- Fluxos ---

describe("fluxos", () => {
  it("search mostra o Pokémon", async () => {
    typing("pikachu");
    await search(new FakeClient(pikachu()));
    expect(output()).toContain("#025 Pikachu");
  });

  it.each([new PokemonNotFoundError("Pokémon 'xyz' not found."), new APIUnavailableError("Could not reach the PokeAPI.")])(
    "search mostra erro sem stack trace: $name",
    async (error) => {
      typing("xyz");
      await search(new FakeClient(undefined, error)); // não pode rejeitar
      expect(output()).toContain(error.message);
    },
  );

  it("browse navega n, n, p, q", async () => {
    const api = new FakeClient();
    typing("n", "n", "p", "q");
    await browse(api, 2);
    expect(api.offsetsPedidos).toEqual([0, 2, 4, 2]);
  });

  it("browse: p na primeira página avisa e não busca de novo", async () => {
    const api = new FakeClient();
    typing("p", "x", "q");
    await browse(api, 2);
    expect(output()).toContain("This is the first page.");
    expect(output()).toContain("Type n, p or q.");
    expect(api.offsetsPedidos).toEqual([0]);
  });

  it("browse: n na última página", async () => {
    const api = new FakeClient();
    typing("n", "n", "n", "q");
    await browse(api, 2);
    expect(output()).toContain("This is the last page.");
    expect(api.offsetsPedidos).toEqual([0, 2, 4]);
  });

  it("menu principal: opção inválida e sair", async () => {
    typing("9", "3");
    await run(new FakeClient());
    expect(output()).toContain("Invalid option. Type 1, 2 or 3.");
    expect(output()).toContain("Bye!");
  });
});
