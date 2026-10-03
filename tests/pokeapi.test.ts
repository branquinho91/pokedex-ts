/** Service: o HTTP é trocado por um mock, então dá pra forçar qualquer cenário. */
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import {
  APIError,
  APITimeoutError,
  APIUnavailableError,
  InvalidInputError,
  InvalidResponseError,
  PokemonNotFoundError,
} from "../src/services/errors";
import { PokeAPIClient } from "../src/services/pokeapi";
import { firstPageJson, pikachuJson } from "./fixtures";

/** Resposta de sucesso "na mão", sem rede. O corpo chega como texto (responseType: "text"). */
function fakeResponse(body: object | string): AxiosResponse<string> {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  return { data, status: 200 } as AxiosResponse<string>;
}

/** Erro que o axios lança quando a API responde 4xx/5xx. */
function httpError(status: number): AxiosError {
  const response = { status } as AxiosResponse;
  return new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_RESPONSE", undefined, {}, response);
}

/** Erro que o axios lança quando nem houve resposta (timeout, rede...). */
function networkError(code: string): AxiosError {
  return new AxiosError(code, code, undefined, {});
}

let api: PokeAPIClient;
let httpGet: MockInstance;

beforeEach(() => {
  // Cliente com o http.get trocado por um mock (que registra as chamadas)
  api = new PokeAPIClient({ timeoutMs: 5000 });
  httpGet = vi.spyOn(api.http, "get");
});

// --- Caminho feliz ---

describe("caminho feliz", () => {
  it("getPokemon devolve objeto pronto", async () => {
    httpGet.mockResolvedValue(fakeResponse(pikachuJson()));
    const pokemon = await api.getPokemon(25);
    expect(pokemon.name).toBe("pikachu");
    expect(pokemon.heightM).toBe(0.4);
  });

  it("normaliza a entrada antes de montar a URL", async () => {
    httpGet.mockResolvedValue(fakeResponse(pikachuJson()));
    await api.getPokemon("  PiKaChU ");
    expect(httpGet).toHaveBeenCalledWith("/pokemon/pikachu", expect.anything());
    expect(api.http.defaults.baseURL).toBe("https://pokeapi.co/api/v2");
  });

  it("toda requisição leva timeout", () => {
    // O timeout fica na instância do axios: nenhuma chamada tem como esquecer
    expect(api.http.defaults.timeout).toBe(5000);
  });

  it("listPokemon manda offset e limit", async () => {
    httpGet.mockResolvedValue(fakeResponse(firstPageJson()));
    const page = await api.listPokemon(40, 2);
    expect(httpGet).toHaveBeenCalledWith("/pokemon", { params: { offset: 40, limit: 2 } });
    expect(page.offset).toBe(40);
  });
});

// --- Entrada inválida: nem chega a fazer a requisição ---

describe("entrada inválida", () => {
  it.each(["", "   ", "pika/chu", "pikachu?x=1", "mr. mime"])("'%s' não chama a API", async (entrada) => {
    await expect(api.getPokemon(entrada)).rejects.toThrow(InvalidInputError);
    expect(httpGet).not.toHaveBeenCalled();
  });
});

// --- Tabela de erros ---

describe("traduz erros", () => {
  it.each([
    { id: "404", http: () => httpGet.mockRejectedValue(httpError(404)), erro: PokemonNotFoundError, causa: APIError },
    { id: "500", http: () => httpGet.mockRejectedValue(httpError(500)), erro: APIError, causa: AxiosError },
    { id: "timeout", http: () => httpGet.mockRejectedValue(networkError("ETIMEDOUT")), erro: APITimeoutError, causa: AxiosError },
    { id: "abortado", http: () => httpGet.mockRejectedValue(networkError("ECONNABORTED")), erro: APITimeoutError, causa: AxiosError },
    { id: "porta-fechada", http: () => httpGet.mockRejectedValue(networkError("ECONNREFUSED")), erro: APIUnavailableError, causa: AxiosError },
    { id: "sem-dns", http: () => httpGet.mockRejectedValue(networkError("ENOTFOUND")), erro: APIUnavailableError, causa: AxiosError },
    { id: "redirects", http: () => httpGet.mockRejectedValue(networkError("ERR_FR_TOO_MANY_REDIRECTS")), erro: APIError, causa: AxiosError },
    { id: "nao-e-json", http: () => httpGet.mockResolvedValue(fakeResponse("<html>oi</html>")), erro: InvalidResponseError, causa: SyntaxError },
    { id: "json-inesperado", http: () => httpGet.mockResolvedValue(fakeResponse({ foo: 1 })), erro: InvalidResponseError, causa: TypeError },
  ])("$id", async ({ http, erro, causa }) => {
    http();
    const err = await api.getPokemon("pikachu").catch((e: unknown) => e);

    expect((err as object).constructor).toBe(erro); // exatamente essa, não uma filha
    expect((err as Error).cause).toBeInstanceOf(causa); // o { cause } guardou a causa
  });

  it("erro que não é do axios (um bug) não é mascarado", async () => {
    const bug = new RangeError("bug nosso");
    httpGet.mockRejectedValue(bug);
    await expect(api.getPokemon("pikachu")).rejects.toBe(bug);
  });

  it("erro HTTP guarda o status", async () => {
    httpGet.mockRejectedValue(httpError(503));
    await expect(api.listPokemon()).rejects.toMatchObject({ statusCode: 503 });
  });

  it("listagem com formato inesperado", async () => {
    httpGet.mockResolvedValue(fakeResponse({ foo: 1 }));
    await expect(api.listPokemon()).rejects.toThrow(InvalidResponseError);
  });
});
