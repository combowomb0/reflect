# Reflect Implementation Plan

This plan is ordered by dependency. Complete higher-priority work before moving to later phases. Effort is relative: **S** is about 0.5-1 day, **M** 1-3 days, and **L** 3-5+ days. Paths describe the intended implementation locations; the repository currently contains the build scaffold but not the application modules.

## Phase 0: Project Setup

### [x] T001 - Establish Electron-vite entry points

- **Description:** Create main, preload, and renderer entry points and configure BrowserWindow startup, development loading, and production loading.
- **Priority:** High
- **Effort:** M
- **Dependencies:** None
- **Affected:** `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/main.tsx`, `electron.vite.config.ts`
- **Deliverable:** A blank secure Electron window runs with `yarn dev` and builds with `yarn build`.

### [x] T002 - Confirm strict TypeScript project configuration

- **Description:** Align node/web tsconfigs, path boundaries, declarations for `window.reflect`, and strict compiler options.
- **Priority:** High
- **Effort:** S
- **Dependencies:** T001
- **Affected:** `tsconfig.node.json`, `tsconfig.web.json`, `src/preload/index.ts`
- **Deliverable:** `yarn typecheck` passes with no `any` escape hatches.

### [x] T003 - Establish linting, formatting, and contribution scripts

- **Description:** Verify ESLint 9 and Prettier rules, add ignores for generated files, and document the required local checks.
- **Priority:** High
- **Effort:** S
- **Dependencies:** T001
- **Affected:** `eslint.config.mjs`, `.prettierrc.json`, `package.json`, `README.md`
- **Deliverable:** `yarn lint`, `yarn format`, and documented validation commands work.

### [x] T004 - Add shared domain contracts

- **Description:** Define OpenAPI document metadata, endpoint descriptors, `MockResponse`, `MockMap`, server status, settings, and typed IPC result contracts.
- **Priority:** High
- **Effort:** M
- **Dependencies:** T002
- **Affected:** `src/shared/types.ts`
- **Deliverable:** Main, preload, renderer, and tests share one explicit contract without duplicated shapes.

### [x] T005 - Establish test harness and temporary fixtures

- **Description:** Configure Vitest for unit tests, add fixture OpenAPI documents, temporary-directory helpers, and coverage reporting.
- **Priority:** High
- **Effort:** M
- **Dependencies:** T002
- **Affected:** `vitest.config.ts`, `tests/fixtures/*`, `tests/helpers/*`, `package.json`
- **Deliverable:** A sample smoke test runs through `yarn test`; coverage can be generated.

## Phase 1: Core MVP

### [x] T006 - Implement OpenAPI parser and validator

- **Description:** Read YAML/JSON from a validated path, call `SwaggerParser.validate`, restrict support to OpenAPI 3.x, resolve references, and normalize operations into endpoint descriptors.
- **Priority:** High
- **Effort:** L
- **Dependencies:** T004, T005
- **Affected:** `src/main/parser.ts`, `src/shared/types.ts`, `tests/parser.test.ts`
- **Deliverable:** Valid specs produce endpoints; malformed, unsupported, unreadable, and missing-response cases return actionable errors.

### [x] T007 - Implement schema-aware Faker mock generator

- **Description:** Generate response bodies from schemas, honoring examples, defaults, enums, required fields, nullable values, arrays, nested objects, constraints, and common formats/field names such as email, UUID, URL, date, name, and phone.
- **Priority:** High
- **Effort:** L
- **Dependencies:** T004, T006
- **Affected:** `src/shared/mockGenerator.ts`, `tests/mockGenerator.test.ts`
- **Deliverable:** A pure `generateMock(schema)` implementation produces valid realistic JSON with documented precedence rules.

### [x] T008 - Implement persistent MockStore

- **Description:** Add JSON read/write, initialization from generated mocks, CRUD by OpenAPI path and uppercase method, atomic persistence, schema/version metadata, and corrupt-file recovery errors. Never write the source specification.
- **Priority:** High
- **Effort:** M
- **Dependencies:** T004, T005, T006, T007
- **Affected:** `src/shared/mockStore.ts`, `src/main/fileMockStore.ts`, `tests/mockStore.test.ts`
- **Deliverable:** A store in Electron `userData` survives restart and supports isolated temporary-directory tests.

### [x] T009 - Build dynamic Express mock server

- **Description:** Create an Express app and start/stop lifecycle that maps every parsed path/method to the active MockMap, returns status/headers/body, handles path parameters, rejects unsupported methods, and responds with useful 4xx/5xx errors.
- **Priority:** High
- **Effort:** L
- **Dependencies:** T006, T008
- **Affected:** `src/main/mockServer.ts`, `src/shared/types.ts`, `tests/mockServer.test.ts`
- **Deliverable:** Supertest verifies generated routes and JSON responses for representative GET, POST, parameterized, and error routes.

### [x] T010 - Add server settings and lifecycle state

- **Description:** Validate configurable ports, persist preferred port, report starting/running/stopped/error states, and prevent duplicate starts or stale handles.
- **Priority:** High
- **Effort:** M
- **Dependencies:** T008, T009
- **Affected:** `src/main/settings.ts`, `src/main/mockServer.ts`, `src/shared/types.ts`, `tests/settings.test.ts`
- **Deliverable:** Main can reliably start and stop one local server and report its actual port.

### [x] T011 - Implement validated IPC and preload bridge

- **Description:** Register allow-listed channels for opening/loading specs, listing/saving mocks, server start/stop/status, settings, and structured errors. Validate every argument in main.
- **Priority:** High
- **Effort:** L
- **Dependencies:** T004, T006, T008, T010
- **Affected:** `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/types.ts`, `tests/ipcValidation.test.ts`
- **Deliverable:** Renderer accesses only typed `window.reflect` methods; no raw Electron API is exposed.

### [x] T012 - Build MVP renderer shell and endpoint list

- **Description:** Add specification load action, endpoint table grouped by path/method, loading/error/empty states, endpoint selection, and server status panel.
- **Priority:** High
- **Effort:** L
- **Dependencies:** T011
- **Affected:** `src/renderer/src/App.tsx`, `src/renderer/src/components/EndpointTable.tsx`, `src/renderer/src/components/ServerControls.tsx`
- **Deliverable:** A user can load a spec, inspect all endpoints, and see server state.

## Phase 2: Mock Editor and Persistence

### [x] T013 - Implement JSON mock editor

- **Description:** Add formatted JSON editing, parse and shape validation, reset-to-generated, save/cancel actions, status-code and headers editing, and clear validation errors.
- **Priority:** High
- **Effort:** L
- **Dependencies:** T007, T008, T012
- **Affected:** `src/renderer/src/components/MockEditor.tsx`, `src/renderer/src/hooks/*`, `src/shared/types.ts`
- **Deliverable:** A selected endpoint's response can be edited and saved without editing the OpenAPI file.

### [x] T014 - Connect server controls end to end

- **Description:** Add validated port input, start/stop buttons, disabled/loading states, live status indication, and recovery UI for startup errors.
- **Priority:** High
- **Effort:** M
- **Dependencies:** T010, T011, T012
- **Affected:** `src/renderer/src/components/ServerControls.tsx`, `src/renderer/src/App.tsx`
- **Deliverable:** Users can control the local server and see its address and current status.

### [x] T015 - Add mock hot-reload behavior

- **Description:** Ensure each request reads the latest persisted MockMap or uses a safe store refresh, and update the UI after saves without restarting Express.
- **Priority:** High
- **Effort:** M
- **Dependencies:** T009, T013, T014
- **Affected:** `src/main/mockServer.ts`, `src/main/fileMockStore.ts`, `src/renderer/src/App.tsx`, `tests/mockServer.test.ts`
- **Deliverable:** A saved response is returned by the already-running server on the next request.

### [x] T016 - Add import and export of mocks

- **Description:** Implement file dialogs, versioned MockMap JSON validation, export of the active map, import preview/replace behavior, and conflict/error handling.
- **Priority:** Medium
- **Effort:** M
- **Dependencies:** T008, T011, T013
- **Affected:** `src/main/ipc.ts`, `src/main/fileMockStore.ts`, `src/renderer/src/components/MockTransfer.tsx`, `tests/mockTransfer.test.ts`
- **Deliverable:** Users can move mock overrides between projects without modifying the OpenAPI source.

## Phase 3: Enhancements

### T017 - Add schema-driven form editor

- **Description:** Provide an optional dynamic form for common object, array, enum, boolean, number, date, and nullable fields while retaining raw JSON mode for advanced cases.
- **Priority:** Medium
- **Effort:** L
- **Dependencies:** T013
- **Affected:** `src/renderer/src/components/SchemaForm.tsx`, `src/renderer/src/components/MockEditor.tsx`
- **Deliverable:** Non-technical users can edit common mock responses without writing JSON.

### [x] T018 - Add endpoint search and filtering

- **Description:** Filter by path, method, tags, operation ID, and response status; preserve selection while filters change.
- **Priority:** Medium
- **Effort:** M
- **Dependencies:** T012
- **Affected:** `src/renderer/src/components/EndpointTable.tsx`, `src/renderer/src/App.tsx`
- **Deliverable:** Large specifications remain navigable.

### [x] T019 - Add request logging and diagnostics

- **Description:** Record method, path, status, duration, and timestamp with bounded retention; expose a renderer log panel and safe error details.
- **Priority:** Medium
- **Effort:** M
- **Dependencies:** T009, T011, T012
- **Affected:** `src/main/mockServer.ts`, `src/shared/types.ts`, `src/renderer/src/components/RequestLog.tsx`
- **Deliverable:** Developers can diagnose frontend requests from inside Reflect without leaking secrets.

### [x] T020 - Add conditional mock variants

- **Description:** Define optional request matching by query, headers, body, or path parameters and choose the highest-priority matching response.
- **Priority:** Low
- **Effort:** L
- **Dependencies:** T015, T019
- **Affected:** `src/shared/types.ts`, `src/main/mockServer.ts`, `src/renderer/src/components/MockEditor.tsx`, `tests/mockServer.test.ts`
- **Deliverable:** One endpoint can model success, validation failure, empty, and authorization scenarios.

### [x] T021 - Improve error handling and recovery

- **Description:** Standardize domain errors across parser, store, IPC, and server; add user-safe messages, retry actions, and corrupt-store backup/recovery.
- **Priority:** Medium
- **Effort:** M
- **Dependencies:** T006, T008, T011, T014
- **Affected:** `src/shared/errors.ts`, `src/main/*`, `src/renderer/src/components/ErrorState.tsx`, tests
- **Deliverable:** Common failures are actionable and do not crash the Electron process.

## Phase 4: Polish, Testing, and Release

### [x] T022 - Complete unit and integration coverage

- **Description:** Cover parser, generator precedence, store CRUD/versioning, IPC validation, server lifecycle, hot reload, and representative UI state transitions; enforce an 80% threshold.
- **Priority:** High
- **Effort:** L
- **Dependencies:** T006-T021 as applicable
- **Affected:** `tests/**/*.test.ts`, `vitest.config.ts`, `package.json`
- **Deliverable:** Reliable CI test suite with coverage output and no flaky network/filesystem assumptions.

### [x] T023 - Tune renderer and server performance

- **Description:** Avoid unnecessary endpoint reprocessing, bound request logs, debounce editor validation, and measure large-spec load and response latency.
- **Priority:** Medium
- **Effort:** M
- **Dependencies:** T012, T015, T019, T022
- **Affected:** `src/renderer/src/*`, `src/main/mockServer.ts`, performance tests
- **Deliverable:** Large specifications remain responsive and server requests have predictable latency.

### [x] T024 - Accessibility and UI/UX polish

- **Description:** Add keyboard navigation, focus management, accessible labels, responsive layouts, clear unsaved-change indicators, empty states, and consistent Ant Design feedback.
- **Priority:** Medium
- **Effort:** M
- **Dependencies:** T012-T018
- **Affected:** `src/renderer/src/*`, renderer styles
- **Deliverable:** The core workflow is usable on small and large windows and with keyboard navigation.

### T025 - Add documentation and TSDoc

- **Description:** Document installation, workflow, MockMap format, IPC contract, supported OpenAPI behavior, troubleshooting, and public module APIs. Keep README and AGENTS instructions current.
- **Priority:** Medium
- **Effort:** M
- **Dependencies:** T001-T021
- **Affected:** `README.md`, `AGENTS.md`, `src/**/*.ts`, `typedoc.json`
- **Deliverable:** A new contributor can run the app and understand extension points without tribal knowledge.

### T026 - Configure electron-builder packaging

- **Description:** Add platform packaging configuration, app metadata, icons, resource paths, userData migration behavior, and a local packaged-app smoke test.
- **Priority:** High
- **Effort:** M
- **Dependencies:** T001, T010, T021, T025
- **Affected:** `package.json`, `electron-builder.yml` or `electron-builder.config.*`, `build/*`
- **Deliverable:** Installers/build artifacts are produced for supported macOS, Windows, and Linux targets.

### T027 - Add CI quality and release workflow

- **Description:** Run lint, typecheck, tests, coverage, and build on pull requests; package signed releases according to repository secrets and platform requirements.
- **Priority:** Medium
- **Effort:** M
- **Dependencies:** T022, T026
- **Affected:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- **Deliverable:** Every change receives automated quality checks and releases are reproducible.

### T028 - Perform final security and release review

- **Description:** Verify Electron flags, CSP, IPC allow-listing, localhost binding, path validation, dependency audit, source-spec immutability, and packaged behavior.
- **Priority:** High
- **Effort:** M
- **Dependencies:** T021, T026, T027
- **Affected:** `src/main/index.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, packaging config, security checklist
- **Deliverable:** Release checklist is signed off with known limitations and rollback/recovery guidance.
