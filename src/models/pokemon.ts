/**
 * Representação própria de Pokémon: só os dados que o app usa.
 *
 * Este módulo não sabe que existe HTTP, terminal nem PokeAPI. A tradução
 * do JSON da API para estes objetos fica em src/mappers/pokeapi.ts.
 *
 * São interfaces (só a forma dos dados), não classes: nada aqui guarda
 * estado nem tem comportamento. Em Python eram @dataclass.
 */

/** Um stat base, ex.: { name: "hp", value: 35 }. */
export interface Stat {
  name: string;
  value: number;
}

/** Uma habilidade. Cada Pokémon tem no máximo uma oculta (hidden). */
export interface Ability {
  name: string;
  isHidden: boolean;
}

export interface Pokemon {
  id: number;
  name: string;
  heightM: number; // em metros
  weightKg: number; // em quilos
  types: string[];
  abilities: Ability[];
  stats: Stat[];
}

/** Item da listagem: a API só manda nome + link, sem detalhes. */
export interface PokemonSummary {
  id: number;
  name: string;
}

/** Uma página da listagem paginada. */
export interface PokemonPage {
  results: PokemonSummary[];
  total: number; // quantos Pokémon existem na API ao todo
  offset: number; // quantos foram pulados antes desta página
  limit: number; // tamanho da página
  hasNext: boolean;
  hasPrevious: boolean;
}
