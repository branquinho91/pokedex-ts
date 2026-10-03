# Pokedex CLI (TypeScript)

Uma Pokédex de terminal em TypeScript que consulta a [PokéAPI](https://pokeapi.co/): busque um Pokémon por nome ou número, navegue pela lista paginada e veja tipos, habilidades e stats.

É a versão TypeScript da [Pokedex CLI em Python](https://github.com/branquinho91/pokedex), com a mesma arquitetura, o mesmo comportamento e os mesmos testes.

```
==============================
#006 Charizard
==============================
Types:     Fire, Flying
Height:    1.7 m
Weight:    90.5 kg
Abilities: Blaze, Solar-Power (hidden)

Stats
  HP          78
  Attack      84
  Defense     78
  Sp. Atk    109
  Sp. Def     85
  Speed      100
```

## Funcionalidades

- **Busca** por nome ou número (`pikachu`, `25`, ` PiKaChU `: maiúsculas e espaços não importam)
- **Detalhes**: número, tipos, altura (m), peso (kg), habilidades (com a oculta marcada) e os 6 stats base
- **Listagem paginada** de 20 em 20, navegando com `[n]` próxima, `[p]` anterior e `[q]` sair
- **Erros com mensagem clara**, nunca stack trace: Pokémon inexistente, entrada inválida, API fora do ar, timeout, erro HTTP e resposta inesperada
- `Ctrl+C` e `Ctrl+D` saem sem stack trace

## Como rodar

Requer **Node 20+** (desenvolvido no 24) e acesso à internet.

```bash
cd pokedex-ts
npm install
npm start
```

```
==============================
POKEDEX
==============================
1. Search Pokémon
2. List Pokémon
3. Exit

Choose an option:
```

Não há etapa de build: o [`tsx`](https://tsx.is/) roda o `.ts` direto, e o `tsc` só confere os tipos.

| Comando | O que faz |
|---|---|
| `npm start` | Abre a Pokédex |
| `npm test` | Roda os testes uma vez |
| `npm run test:watch` | Roda os testes de novo a cada arquivo salvo |
| `npm run typecheck` | Confere os tipos com o `tsc` (sem gerar arquivos) |

## Testes

```bash
npm test
```

São 46 testes com [Vitest](https://vitest.dev/) que rodam em ~0,3 s **sem acessar a internet**: o `http.get` do axios é trocado por mocks, o `input()` é um mock e a CLI recebe um cliente falso.

| Arquivo | O que cobre |
|---|---|
| `tests/mapper.test.ts` | Conversão do JSON da API: unidades, tipos, habilidade oculta, paginação, id vindo da URL |
| `tests/pokeapi.test.ts` | Normalização da entrada, timeout configurado e a tradução de cada erro do axios |
| `tests/menu.test.ts` | Formatação da tela e fluxos do menu (busca, erros, navegação `n`/`p`/`q`) |

## Arquitetura

O código é dividido em camadas, e cada uma só conhece a de baixo:

```
cli/menu.ts  ──▶  services/pokeapi.ts  ──▶  mappers/pokeapi.ts  ──▶  models/pokemon.ts
(usuário)         (HTTP)                    (formato da API)          (dados do domínio)
```

```
pokedex-ts/
├── package.json             # dependências e scripts (npm start, npm test)
├── tsconfig.json            # TypeScript em modo strict
├── src/
│   ├── main.ts              # ponto de entrada; trata Ctrl+C / Ctrl+D
│   ├── models/pokemon.ts    # interfaces: Pokemon, Stat, Ability, PokemonSummary, PokemonPage
│   ├── mappers/pokeapi.ts   # JSON da PokéAPI -> models (+ os tipos do JSON da API)
│   ├── services/
│   │   ├── pokeapi.ts       # PokeAPIClient: HTTP, timeout, validação, tradução de erros
│   │   └── errors.ts        # hierarquia de exceções do app
│   └── cli/
│       ├── menu.ts          # todo input() e console.log() fica aqui
│       └── input.ts         # o input() do Python, em cima do readline do Node
└── tests/
    ├── fixtures.ts          # JSONs mínimos da API (o conftest.py)
    └── *.test.ts
```

| Camada | Sabe | Não sabe |
|---|---|---|
| **model** | o que é um Pokémon | que existe HTTP, terminal ou PokéAPI |
| **mapper** | o formato do JSON da PokéAPI | de onde o JSON veio |
| **service** | URL, timeout, status code, `axios` | que existe terminal (não usa `console.log` nem `input`) |
| **cli** | como conversar com o usuário | montar URL, ler JSON, que existe `axios` |

### Decisões de design

- **Model próprio em vez do JSON da API.** O JSON de um Pokémon tem cerca de 15 mil linhas (93% são golpes). O `Pokemon` guarda só o que o app usa, já em metros e quilos (a API manda decímetros e hectogramas).
- **Models são `interface`, não `class`.** Eles só descrevem a forma dos dados, sem estado nem comportamento. É o que mais se aproxima do `@dataclass` do Python, e a comparação nos testes é por valor (`toEqual`).
- **Mapper separado do model.** O `Pokemon` não conhece a PokéAPI. Se a API mudar de formato, ou surgir outra fonte (um cache, por exemplo), a mudança fica no mapper. Os tipos do JSON da API (`ApiPokemon`, `ApiPokemonList`) também moram no mapper.
- **Tipos não existem em execução.** Assim como os type hints do Python, os tipos do TypeScript somem quando o código roda. O `getJson<ApiPokemon>()` só *promete* o formato; se a API mandar outra coisa, o mapper lança `TypeError` e o service traduz para `InvalidResponseError`.
- **Um único ponto de HTTP.** Todo request passa pelo `PokeAPIClient.getJson`, sobre uma instância do `axios.create()` que já carrega URL base e timeout (o papel da `requests.Session`). Nenhuma chamada tem como esquecer o timeout.
- **O `JSON.parse` é nosso.** O axios recebe o corpo como texto (`responseType: "text"`). Por padrão, ele tentaria converter e, se não fosse JSON, devolveria a string sem avisar. Assim, resposta que não é JSON vira `InvalidResponseError`.
- **Exceções do domínio.** O service traduz os erros do axios para exceções próprias, guardando o erro original em `{ cause }` (o `raise ... from err` do Python). A CLI captura só `PokedexError` e mostra a mensagem, sem saber que o axios existe. Qualquer outro erro (um bug nosso) não é mascarado.

  | Situação | Erro do axios/JS | Nossa exceção |
  |---|---|---|
  | Entrada vazia ou com caracteres inválidos | (validado antes do request) | `InvalidInputError` |
  | Pokémon inexistente (404) | `AxiosError` com `response.status` 404 | `PokemonNotFoundError` |
  | Timeout | `AxiosError` com `code` `ETIMEDOUT` | `APITimeoutError` |
  | Sem rede / API fora | `AxiosError` com `code` `ECONNREFUSED`, `ENOTFOUND`... | `APIUnavailableError` |
  | Outro erro HTTP | `AxiosError` com `response` | `APIError` |
  | JSON inválido ou inesperado | `SyntaxError` / `TypeError` | `InvalidResponseError` |

- **Timeout checado primeiro.** Um timeout também chega sem resposta, igual a "API fora". Por isso ele é testado antes: é o equivalente ao `ConnectTimeout` do `requests`, que é filho de `Timeout` e de `ConnectionError` ao mesmo tempo.
- **Id da listagem vem da URL, não da posição.** Depois do #1025, a PokéAPI lista as formas alternativas com ids a partir de 10001. Numerar por posição mostraria ids que não existem na busca.
- **A CLI depende de um "formato", não de uma classe.** O `run(api)` aceita qualquer `PokedexApi` (só `getPokemon` e `listPokemon`). Com a tipagem estrutural do TypeScript, o `FakeClient` dos testes serve sem herdar de nada, como o duck typing do Python.
- **POO moderada.** Classes onde há estado (`PokeAPIClient`) ou hierarquia (exceções), funções onde basta (mapper, formatação).

## Python × TypeScript

O que mudou na tradução, para consulta:

| Python | TypeScript |
|---|---|
| `@dataclass` | `interface` |
| `requests.Session()` | `axios.create({ baseURL, timeout })` |
| `timeout=10.0` (segundos) | `timeout: 10_000` (milissegundos) |
| `response.raise_for_status()` | automático: o axios rejeita 4xx/5xx sozinho |
| `response.json()` | `JSON.parse(response.data)` |
| `class X(Exception)` | `class X extends Error` |
| `raise X(...) from err` | `throw new X(..., { cause: err })` |
| `except PokedexError as err` | `catch (err) { if (err instanceof PokedexError) ... }` |
| `input()` | `input()` em `cli/input.ts`, com `readline` e `await` |
| `print()` | `console.log()` |
| `KeyboardInterrupt` / `EOFError` | `InputClosedError` (o readline fecha no Ctrl+C e no Ctrl+D) |
| `f"{x:03d}"`, `f"{s:<11}"`, `f"{n:>4}"` | `String(x).padStart(3, "0")`, `s.padEnd(11)`, `String(n).padStart(4)` |
| `name.title()` | `displayName()` com regex |
| `api or PokeAPIClient()` | parâmetro com valor padrão: `api = new PokeAPIClient()` |
| `pytest` | `vitest` |
| fixture do `conftest.py` | função em `tests/fixtures.ts` que devolve uma cópia nova |
| `@pytest.mark.parametrize` | `it.each([...])` |
| `unittest.mock.Mock` | `vi.fn()` / `vi.spyOn()` |
| `monkeypatch.setattr("builtins.input", ...)` | `vi.mock("../src/cli/input")` |
| `capsys.readouterr().out` | `vi.spyOn(console, "log")` |
| `pytest.raises(Erro)` | `await expect(promise).rejects.toThrow(Erro)` |

A maior diferença de fundo: em Node, HTTP e leitura do terminal são **assíncronos**. Por isso quase tudo na CLI e no service é `async` e é chamado com `await`.

## Próximos passos

- Unidades imperiais (ft/in, lb) calculadas a partir de metro e kg
- Cache em memória das buscas
- Saída colorida com [`chalk`](https://github.com/chalk/chalk)
- Validar o JSON da API em execução com [`zod`](https://zod.dev/), em vez de só confiar no tipo

## Sobre

Projeto de estudo: HTTP e APIs REST, JSON, TypeScript, programação assíncrona, exceções, separação de responsabilidades e testes.

Dados fornecidos pela [PokéAPI](https://pokeapi.co/). Pokémon e seus nomes são marcas da Nintendo, Game Freak e Creatures Inc.
