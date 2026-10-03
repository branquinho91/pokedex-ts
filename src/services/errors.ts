/**
 * Exceções do app: erros com nome e sentido para o domínio.
 *
 * Hierarquia (quem captura a de cima, captura todas as de baixo):
 *
 *     PokedexError
 *     ├── InvalidInputError
 *     ├── PokemonNotFoundError
 *     └── APIError
 *         ├── APITimeoutError
 *         ├── APIUnavailableError
 *         └── InvalidResponseError
 *
 * A mensagem de cada exceção já é pensada para o usuário final.
 * O erro original vai em { cause }, o equivalente ao "raise ... from err".
 */

/** Base de todos os erros esperados do app. A CLI captura esta. */
export class PokedexError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    // Sem isso o stack trace mostraria "Error" em vez do nome da classe filha
    this.name = new.target.name;
  }
}

/** O usuário digitou algo que não dá para buscar. */
export class InvalidInputError extends PokedexError {}

/** A API respondeu 404: o Pokémon não existe. */
export class PokemonNotFoundError extends PokedexError {}

/** Falha ao falar com a PokeAPI. */
export class APIError extends PokedexError {
  constructor(
    message: string,
    readonly statusCode: number | null = null, // null quando nem houve resposta
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** A API demorou mais que o timeout para responder. */
export class APITimeoutError extends APIError {}

/** Não deu para conectar: sem internet, DNS falhou ou API fora do ar. */
export class APIUnavailableError extends APIError {}

/** A API respondeu, mas com um JSON inválido ou num formato inesperado. */
export class InvalidResponseError extends APIError {}
