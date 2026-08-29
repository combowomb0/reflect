# Reflect Developer Guide

## Product Vision

Reflect is a secure desktop tool for frontend teams that turns an OpenAPI 3.x contract into a local, editable HTTP mock server. A developer loads a YAML specification, Reflect validates and understands its endpoints, generates useful example responses, and serves those responses through Express. The original contract remains untouched; overrides live in a separate persisted mock map.

The business value is faster frontend development with fewer backend dependencies. Teams can build against a stable contract, reproduce edge cases locally, share deterministic mock data, and iterate on UI behavior without waiting for a deployed API. The MVP optimizes for a short path from specification to a working server, while keeping the boundaries needed for later collaboration and richer scenarios.

## Architecture

Reflect is an Electron application split into three trust boundaries:

```text
                  contextBridge (window.reflect)
       +-----------------------------------------------+
       | Renderer process                              |
       | React + Ant Design                            |
       | Load spec, endpoint list, editor, controls    |
       +-------------------------+---------------------+
                                 | typed, allow-listed IPC
       +-------------------------v---------------------+
       | Preload process                               |
       | Small contextBridge API; no arbitrary IPC     |
       +-------------------------+---------------------+
                                 |
       +-------------------------v---------------------+
       | Main process                                  |
       | OpenAPI parsing, file dialogs, settings,     |
       | MockStore, Express MockServer, IPC handlers  |
       +-------------------------+---------------------+
                                 |
       +-------------------------v---------------------+
       | Shared modules                                |
       | Types/contracts and schema-aware generation  |
       +-----------------------------------------------+
```

- **Main process (`src/main`)** owns filesystem access, dialogs, OpenAPI validation, persistent state, IPC handlers, and the Express server. It is the only layer allowed to use Node or Electron privileged APIs.
- **Preload (`src/preload`)** exposes the smallest typed API needed by the renderer through `contextBridge`. It must not expose `ipcRenderer`, filesystem methods, or arbitrary channel invocation.
- **Renderer (`src/renderer`)** is a normal React web application. It displays endpoints and server state, validates editor input, and calls only `window.reflect` methods from the preload contract.
- **Shared (`src/shared`)** contains platform-neutral types, OpenAPI-facing contracts, and mock generation. Shared code must remain usable without Electron.

Typical flow:

1. The renderer asks the preload API to open a specification.
2. Main reads the selected file and calls `parseOpenAPIFile` using `@apidevtools/swagger-parser`.
3. Main returns a sanitized endpoint model and generated or stored responses.
4. The renderer edits a response and sends a typed save request.
5. Main validates the request, writes the mock map under Electron `userData`, and the running server reads the latest store for each request.

## Technology Stack

- Electron 35 for the desktop shell and process isolation.
- electron-vite 3 and Vite 6 for main, preload, and renderer builds.
- TypeScript 5 with strict compiler settings.
- React 18 and React DOM for the UI.
- Ant Design 5 for accessible desktop controls and layout primitives.
- Express 4 for the local mock HTTP server.
- `@apidevtools/swagger-parser` for OpenAPI parsing and validation.
- `openapi-types` for OpenAPI TypeScript contracts.
- `@faker-js/faker` for realistic schema-aware values.
- Vitest is the configured test runner (`yarn test`); use Supertest for Express integration tests. If the project standardizes on Jest later, preserve the same test boundaries and update scripts/configuration together.
- ESLint 9 and Prettier 3 for static analysis and formatting.
- electron-builder is the intended packaging tool and should be added to dependencies when packaging work begins.

## Project Structure

The current repository is a scaffold. Create the following structure as implementation proceeds:

```text
.
├── src/
│   ├── main/
│   │   ├── index.ts          # BrowserWindow lifecycle and app startup
│   │   ├── ipc.ts            # Validated IPC handlers and channel registration
│   │   ├── parser.ts         # Read and validate OpenAPI files
│   │   ├── fileMockStore.ts  # JSON persistence in Electron userData
│   │   ├── mockServer.ts     # Express app and dynamic route lifecycle
│   │   └── settings.ts       # Port and selected specification settings
│   ├── preload/
│   │   └── index.ts          # contextBridge and Window API declarations
│   ├── renderer/src/
│   │   ├── App.tsx
│   │   ├── components/       # EndpointTable, MockEditor
│   │   ├── hooks/            # Renderer state and IPC hooks
│   │   └── main.tsx
│   └── shared/
│       ├── types.ts          # IPC, endpoint, settings, and MockMap contracts
│       └── mockGenerator.ts  # Pure schema-to-value generation
├── tests/
│   ├── parser.test.ts
│   ├── mockGenerator.test.ts
│   ├── mockStore.test.ts
│   └── mockServer.test.ts
├── electron.vite.config.ts
├── eslint.config.mjs
├── .prettierrc.json
├── package.json
└── TODO.md
```

## Setup and Commands

Prerequisites: Node.js 20 or newer, Yarn 4, and a platform supported by Electron. Verify with `node --version` and `yarn --version`.

```sh
git clone <repository-url>
cd reflect
yarn install
yarn dev
```

Useful commands:

```sh
yarn dev          # Electron with electron-vite development reload
yarn build        # type-check and produce out/ build artifacts
yarn typecheck    # check node and web TypeScript projects
yarn lint         # ESLint with zero warnings allowed
yarn test         # Vitest test run
yarn format       # Prettier write across the repository
```

Run `yarn lint`, `yarn typecheck`, and `yarn test` before submitting changes. Use `yarn build` to verify packaging inputs after changes to process boundaries or Vite configuration.

## Coding Guidelines

- Keep TypeScript strict. Do not use `any`; use `unknown` at file, IPC, and HTTP boundaries and narrow it with validators.
- Keep privileged work in `src/main`. Renderer code must not import Electron, Node built-ins, Express, or filesystem code.
- Define or update shared contracts before implementing main, preload, and renderer behavior.
- Validate every IPC argument in `src/main/ipc.ts`, including paths, HTTP methods, ports, JSON values, and enum-like strings.
- Prefer small pure functions, especially in the parser and generator. Keep I/O and side effects at the edges.
- Use Prettier defaults from `.prettierrc.json`: two spaces, single quotes, trailing commas, 100-column print width. ESLint must pass with no warnings.
- Use `PascalCase` for React components and classes, `camelCase` for functions, variables, hooks, and IPC methods, and uppercase HTTP method values such as `GET` and `POST`.
- Use descriptive filenames in `camelCase` for modules and `PascalCase.tsx` for components. Test files end in `.test.ts` or `.test.tsx`.
- Add concise TSDoc to public exports and comments only where a non-obvious invariant needs explanation.

### Adding an endpoint capability

1. Extend `src/shared/types.ts` with the request and response contract.
2. Add pure/main-process behavior and validate all external input.
3. Expose only the required method through `src/preload/index.ts`.
4. Add renderer state and UI last.
5. Add unit tests for contracts and behavior plus Supertest coverage for HTTP behavior.

### Modifying mock generation

Add a focused rule to `generateMock` in `src/shared/mockGenerator.ts`. Precedence should be explicit `example`, enum, schema constraints, format, type, then field-name heuristics. Preserve required fields, array/object structure, nullable behavior, and deterministic test injection where needed. Add a regression case to `tests/mockGenerator.test.ts`; do not couple generator tests to Electron or the filesystem.

## Mock Data and Configuration

The OpenAPI file is read-only. A `MockMap` is persisted separately, keyed by path and uppercase method:

```json
{
  "version": 1,
  "specPath": "/Users/example/api/openapi.yaml",
  "mocks": {
    "/users": {
      "GET": { "status": 200, "headers": {}, "body": { "users": [] } }
    },
    "/users/{id}": {
      "GET": { "status": 200, "headers": {}, "body": { "id": "user-1" } }
    }
  }
}
```

Store files belong in Electron's `app.getPath('userData')`, not beside or inside the source specification. Use atomic writes where practical and handle missing or corrupt JSON with a clear recovery error. Port, last selected specification, and mock-store path are application settings; they should be persisted in a separate settings file in `userData`. A user-selected mock path may be supported, but must be validated and never permit arbitrary renderer-controlled file access.

## IPC Contract

Use explicit channels and typed methods, for example: `spec:open`, `spec:load`, `mocks:list`, `mocks:save`, `server:start`, `server:stop`, and `server:status`. The preload API should expose methods such as `openSpec()`, `saveMock(input)`, `startServer(port)`, and `getServerStatus()`, not raw channel names.

IPC handlers must return structured success/error results, avoid leaking stack traces to the renderer, and reject malformed inputs before filesystem or server work. Keep the API backwards-compatible once released because the preload and renderer are separate compile targets.

## Testing Strategy

- **Unit tests:** parser normalization/error cases, generator precedence and formats, MockMap CRUD/serialization, settings validation, and IPC input validators.
- **Integration tests:** build an Express app with a temporary store and use Supertest to verify route generation, status codes, JSON bodies, unknown routes, path parameters, and saved mock hot-reload without restarting the server.
- **Renderer tests:** test endpoint selection, invalid JSON handling, loading/error states, and server control state transitions where a renderer test environment is introduced.
- Keep tests isolated with temporary directories and restore Faker state or inject a seeded/random source where deterministic values matter.
- Target at least 80% overall statement/branch coverage, with higher coverage for parser, generator, store, and server modules. Enforce the threshold in CI once the baseline exists.

## Security Practices

- Create windows with `nodeIntegration: false`, `contextIsolation: true`, and a preload script loaded from the packaged path.
- Expose only the allow-listed `window.reflect` API through `contextBridge`; never expose `ipcRenderer`, `fs`, `process`, or Electron objects.
- Set a restrictive renderer Content Security Policy in the production HTML. Avoid inline scripts and remote code.
- Validate OpenAPI file size, extension, parse result, and path handling. Never execute content from a specification.
- Bind the mock server deliberately, defaulting to localhost. Validate ports and avoid exposing it publicly without an explicit product decision.
- Escape or safely render user-provided endpoint names and JSON. Do not interpolate untrusted route fragments into executable code.
- Keep secrets out of logs and persisted mock files. Treat imported mock JSON as untrusted input.

## Troubleshooting

- **`yarn install` fails:** confirm Node/Yarn versions and that Yarn's configured `node-modules` linker is active; remove only generated install artifacts if dependencies are inconsistent, then reinstall.
- **Electron window is blank:** inspect the renderer console, verify `electron.vite.config.ts`, and run `yarn typecheck`; renderer imports must not reference Node/Electron modules.
- **IPC method is undefined:** check that the preload bridge, `Window` type declaration, handler registration, and renderer method name all match.
- **Specification is rejected:** validate that it is OpenAPI 3.x YAML/JSON, inspect the parser error, and check `$ref` paths and response schemas.
- **Port is unavailable:** choose another valid port, stop the process holding it, or let the server select a configured free port if that behavior is implemented.
- **Edits do not affect responses:** confirm the save handler wrote the active MockMap and that each request reads the current store rather than a startup-only snapshot.
- **Packaged app cannot find files:** use Electron resource paths and `app.getPath('userData')`; never assume the development working directory.

## Contribution Workflow

1. Select a TODO task and confirm its dependencies are complete.
2. Keep the change focused and update shared contracts first when a boundary changes.
3. Add or update tests with the behavior change.
4. Run formatting, lint, typecheck, tests, and a production build as appropriate.
5. Update TSDoc, README guidance, and TODO status when behavior or setup changes.
6. Submit a review with the task ID, behavior summary, test commands/results, and any known limitations.

Do not modify the original OpenAPI specification, weaken Electron security defaults, bypass IPC validation, or commit generated build output, local settings, mock data, or secrets.
