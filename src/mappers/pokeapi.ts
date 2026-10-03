/**
 * Tradução do formato da PokeAPI para os nossos models.
 *
 * É o único lugar do app que conhece o formato do JSON da PokeAPI.
 * Se a API mudar, a correção fica aqui.
 */
import type { Pokemon, PokemonPage } from "../models/pokemon";

// --- Formato do JSON da PokeAPI (só os campos que a gente lê) ---
// Tipos não existem em execução: isto descreve o que a API *deveria* mandar.
// Se ela mandar outra coisa, o mapper quebra e o service traduz o erro.

interface NamedResource {
  name: string;
  url: string;
}

export interface ApiPokemon {
  id: number;
  name: string;
  height: number; // decímetros
  weight: number; // hectogramas
  types: { slot: number; type: NamedResource }[];
  abilities: { ability: NamedResource; is_hidden: boolean; slot: number }[];
  stats: { base_stat: number; effort: number; stat: NamedResource }[];
}

export interface ApiPokemonList {
  count: number;
  next: string | null;
  previous: string | null;
  results: NamedResource[];
}

/** Monta um Pokemon a partir do JSON de /api/v2/pokemon/{nome_ou_id}. */
export function pokemonFromApi(data: ApiPokemon): Pokemon {
  return {
    id: data.id,
    name: data.name,
    // A API manda decímetros e hectogramas: ÷ 10 vira metro e kg
    heightM: data.height / 10,
    weightKg: data.weight / 10,
    types: data.types.map((t) => t.type.name),
    abilities: data.abilities.map((a) => ({ name: a.ability.name, isHidden: a.is_hidden })),
    stats: data.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
  };
}

/** Monta uma PokemonPage a partir do JSON de /api/v2/pokemon?offset=&limit=. */
export function pageFromApi(data: ApiPokemonList, offset: number, limit: number): PokemonPage {
  return {
    results: data.results.map((r) => ({ id: idFromUrl(r.url), name: r.name })),
    total: data.count,
    offset,
    limit,
    // next/previous vêm null quando não existe a página
    hasNext: data.next !== null,
    hasPrevious: data.previous !== null,
  };
}

/** 'https://pokeapi.co/api/v2/pokemon/25/' -> 25 */
function idFromUrl(url: string): number {
  const id = Number(url.replace(/\/+$/, "").split("/").at(-1));
  // Number("abc") dá NaN em vez de lançar erro (o int() do Python lançava)
  if (!Number.isInteger(id)) {
    throw new TypeError(`URL without a numeric id: ${url}`);
  }
  return id;
}
