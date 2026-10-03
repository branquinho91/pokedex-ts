/**
 * Dados de teste compartilhados (o conftest.py do pytest).
 *
 * São funções e não constantes: cada teste recebe uma cópia nova
 * e pode alterar à vontade. Os JSONs são versões mínimas dos da
 * PokeAPI, só com os campos que o app usa. Nenhum teste acessa a internet.
 */
import type { ApiPokemon, ApiPokemonList } from "../src/mappers/pokeapi";

/** Resposta de /pokemon/pikachu, enxugada. */
export function pikachuJson(): ApiPokemon {
  return {
    id: 25,
    name: "pikachu",
    height: 4,
    weight: 60,
    types: [{ slot: 1, type: { name: "electric", url: ".../type/13/" } }],
    abilities: [
      { ability: { name: "static", url: "..." }, is_hidden: false, slot: 1 },
      { ability: { name: "lightning-rod", url: "..." }, is_hidden: true, slot: 3 },
    ],
    stats: [
      { base_stat: 35, effort: 0, stat: { name: "hp", url: "..." } },
      { base_stat: 55, effort: 0, stat: { name: "attack", url: "..." } },
      { base_stat: 40, effort: 0, stat: { name: "defense", url: "..." } },
      { base_stat: 50, effort: 0, stat: { name: "special-attack", url: "..." } },
      { base_stat: 50, effort: 0, stat: { name: "special-defense", url: "..." } },
      { base_stat: 90, effort: 2, stat: { name: "speed", url: "..." } },
    ],
  };
}

/** Resposta de /pokemon?offset=0&limit=2. */
export function firstPageJson(): ApiPokemonList {
  return {
    count: 1351,
    next: "https://pokeapi.co/api/v2/pokemon?offset=2&limit=2",
    previous: null,
    results: [
      { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/" },
      { name: "ivysaur", url: "https://pokeapi.co/api/v2/pokemon/2/" },
    ],
  };
}
