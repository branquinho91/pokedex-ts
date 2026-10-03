/** Mapper: JSON entra, objeto sai. Funções puras, sem truque nenhum. */
import { describe, expect, it } from "vitest";

import { pageFromApi, pokemonFromApi } from "../src/mappers/pokeapi";
import { firstPageJson, pikachuJson } from "./fixtures";

describe("pokemonFromApi", () => {
  it("campos simples", () => {
    const pokemon = pokemonFromApi(pikachuJson());
    expect(pokemon.id).toBe(25);
    expect(pokemon.name).toBe("pikachu");
  });

  it("converte decímetros e hectogramas", () => {
    const pokemon = pokemonFromApi(pikachuJson());
    expect(pokemon.heightM).toBe(0.4);
    expect(pokemon.weightKg).toBe(6);
  });

  it("tipos mantêm a ordem dos slots", () => {
    const json = pikachuJson();
    json.types.push({ slot: 2, type: { name: "flying", url: "..." } });
    expect(pokemonFromApi(json).types).toEqual(["electric", "flying"]);
  });

  it("habilidades indicam a oculta", () => {
    expect(pokemonFromApi(pikachuJson()).abilities).toEqual([
      { name: "static", isHidden: false },
      { name: "lightning-rod", isHidden: true },
    ]);
  });

  it("stats", () => {
    const stats = pokemonFromApi(pikachuJson()).stats;
    expect(stats).toHaveLength(6);
    expect(stats[0]).toEqual({ name: "hp", value: 35 });
    expect(stats.at(-1)).toEqual({ name: "speed", value: 90 });
  });

  it("JSON sem campo obrigatório lança TypeError", () => {
    // O mapper não trata erro: quem traduz é o service
    const json: Partial<ReturnType<typeof pikachuJson>> = pikachuJson();
    delete json.types;
    expect(() => pokemonFromApi(json as ReturnType<typeof pikachuJson>)).toThrow(TypeError);
  });
});

describe("pageFromApi", () => {
  it("página", () => {
    const page = pageFromApi(firstPageJson(), 0, 2);
    expect(page.results).toEqual([
      { id: 1, name: "bulbasaur" },
      { id: 2, name: "ivysaur" },
    ]);
    expect(page.total).toBe(1351);
    expect([page.offset, page.limit]).toEqual([0, 2]);
  });

  it("primeira página não tem anterior", () => {
    const page = pageFromApi(firstPageJson(), 0, 2);
    expect(page.hasNext).toBe(true);
    expect(page.hasPrevious).toBe(false);
  });

  it("última página não tem próxima", () => {
    const json = firstPageJson();
    json.next = null;
    json.previous = "https://pokeapi.co/api/v2/pokemon?offset=0&limit=2";
    const page = pageFromApi(json, 2, 2);
    expect(page.hasNext).toBe(false);
    expect(page.hasPrevious).toBe(true);
  });

  it("id vem da URL e não da posição", () => {
    // Depois do 1025 vêm as formas alternativas, com ids a partir de 10001
    const json = firstPageJson();
    json.results = [{ name: "golisopod-mega", url: "https://pokeapi.co/api/v2/pokemon/10316/" }];
    const page = pageFromApi(json, 1340, 20);
    expect(page.results[0]?.id).toBe(10316);
  });

  it("URL sem id numérico lança TypeError", () => {
    const json = firstPageJson();
    json.results = [{ name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/bulbasaur/" }];
    expect(() => pageFromApi(json, 0, 20)).toThrow(TypeError);
  });
});
