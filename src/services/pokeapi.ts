/**
 * Cliente da PokeAPI: todo o HTTP do app passa por aqui.
 *
 * Não usa console.log nem input. Recebe parâmetros, faz a requisição e
 * devolve objetos prontos (a tradução do JSON fica no mapper).
 * Erros do axios nunca saem daqui: viram exceções de errors.ts.
 */
import axios, { type AxiosInstance } from "axios";

import { type ApiPokemon, type ApiPokemonList, pageFromApi, pokemonFromApi } from "../mappers/pokeapi";
import type { Pokemon, PokemonPage } from "../models/pokemon";
import {
  APIError,
  APITimeoutError,
  APIUnavailableError,
  InvalidInputError,
  InvalidResponseError,
  PokemonNotFoundError,
} from "./errors";

// Nomes da PokeAPI: minúsculas, números e hífen (ex.: "mr-mime", "porygon-z")
const VALID_KEY = /^[a-z0-9-]+$/;

// Códigos de erro do Node/axios quando nem houve resposta
const TIMEOUT_CODES = new Set(["ETIMEDOUT", "ECONNABORTED"]);
const UNAVAILABLE_CODES = new Set([
  "ERR_NETWORK",
  "ECONNREFUSED", // porta fechada / API fora do ar
  "ECONNRESET",
  "ENOTFOUND", // DNS não achou o host (sem internet, por exemplo)
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

export interface PokeAPIClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class PokeAPIClient {
  static readonly BASE_URL = "https://pokeapi.co/api/v2";

  // A instância do axios guarda a configuração (URL base, timeout) e
  // reaproveita a conexão entre requisições, como a requests.Session
  readonly http: AxiosInstance;

  constructor({ baseUrl = PokeAPIClient.BASE_URL, timeoutMs = 10_000 }: PokeAPIClientOptions = {}) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ""),
      timeout: timeoutMs,
      // Corpo como texto: o JSON.parse é nosso, para tratar resposta que não é JSON
      responseType: "text",
      // Timeout vira ETIMEDOUT (o padrão, ECONNABORTED, também serve para "cancelado")
      transitional: { clarifyTimeoutError: true },
    });
  }

  async getPokemon(nameOrId: string | number): Promise<Pokemon> {
    // " Pikachu " -> "pikachu"; 25 -> "25"
    const key = String(nameOrId).trim().toLowerCase();
    if (!key) {
      throw new InvalidInputError("Please type a Pokémon name or number.");
    }
    if (!VALID_KEY.test(key)) {
      throw new InvalidInputError(
        `Invalid name: '${key}'. Use letters, numbers and hyphens (e.g. mr-mime).`,
      );
    }

    let data: ApiPokemon;
    try {
      data = await this.getJson<ApiPokemon>(`/pokemon/${key}`);
    } catch (err) {
      if (err instanceof APIError && err.statusCode === 404) {
        throw new PokemonNotFoundError(`Pokémon '${key}' not found.`, { cause: err });
      }
      throw err; // qualquer outro erro sobe do jeito que veio
    }

    return this.map(() => pokemonFromApi(data));
  }

  async listPokemon(offset = 0, limit = 20): Promise<PokemonPage> {
    const data = await this.getJson<ApiPokemonList>("/pokemon", { offset, limit });
    return this.map(() => pageFromApi(data, offset, limit));
  }

  /** Roda o mapper. Se o JSON não tinha o formato esperado, vira InvalidResponseError. */
  private map<T>(mapper: () => T): T {
    try {
      return mapper();
    } catch (err) {
      // O mapper é "inocente": lança TypeError ao ler campo que não existe
      if (err instanceof TypeError) {
        throw new InvalidResponseError("The PokeAPI sent data in an unexpected format.", null, {
          cause: err,
        });
      }
      throw err;
    }
  }

  /**
   * GET na API com timeout. Único lugar que chama o axios.
   *
   * O <T> só informa ao TypeScript o formato esperado: nada é checado em
   * execução. Quem descobre que o JSON veio errado é o mapper.
   */
  private async getJson<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    let body: string;
    try {
      const response = await this.http.get<string>(path, { params });
      body = response.data;
    } catch (err) {
      throw translateHttpError(err);
    }

    try {
      return JSON.parse(body) as T;
    } catch (err) {
      // corpo não é JSON
      throw new InvalidResponseError("The PokeAPI sent an invalid response.", null, { cause: err });
    }
  }
}

/** Erro do axios -> nossa exceção. Qualquer outra coisa (um bug nosso) volta como veio. */
function translateHttpError(err: unknown): unknown {
  if (!axios.isAxiosError(err)) {
    return err;
  }
  const code = err.code ?? "";
  // Timeout antes de tudo: também não tem resposta, mas não é "API fora"
  if (TIMEOUT_CODES.has(code)) {
    return new APITimeoutError("The PokeAPI took too long to respond. Try again.", null, { cause: err });
  }
  if (err.response) {
    const status = err.response.status;
    return new APIError(`The PokeAPI returned an error (HTTP ${status}).`, status, { cause: err });
  }
  if (UNAVAILABLE_CODES.has(code)) {
    return new APIUnavailableError("Could not reach the PokeAPI. Check your connection.", null, {
      cause: err,
    });
  }
  // qualquer outra falha do axios (ex.: redirects demais)
  return new APIError("Unexpected error talking to the PokeAPI.", null, { cause: err });
}
