---
name: build-native-app-from-repo
description: Use when planning, building, or testing an iOS or Android app from the GitHub source of an existing web service such as Agentik, including native React Native ports and explicitly requested Capacitor wrappers.
---

# Build Native App from Repo

Use the identified source revision and service contracts to carry the product into a mobile app. Keep the web client and deployed service working throughout the port.

## Identify the source and scope

1. Resolve the GitHub repository and requested commit, tag, or branch to an exact SHA. Check the checkout, working tree, and GitHub upstream before changing files. When asked to match a live deployment, compare its recorded deployment SHA as well. If upstream or deployment metadata is unavailable, state what you verified and which source you can use. Preserve existing local changes and work in a separate mobile package or checkout when needed.
2. Read project instructions, manifests, lockfiles, tests, CI and deployment configuration, and environment variable names. Find the active web entry points and server handlers. Map routes and flows to API origins, auth/session contracts, data ownership, and offline behavior. Identify portable code and assets and isolate DOM, browser storage, workers, and rendering dependencies. Check the current commit even when the product behavior seems familiar.
3. Identify the requested platforms and result. A plan ends with source findings, migration steps, and open decisions. A development request can deliver a local preview or installable test artifact. Build a release artifact only when requested. Treat cloud source upload, production signing, store submission, and publication as distinct actions that require authorization. Use local tools by default.

## Choose the implementation

| Requested app | Approach |
| --- | --- |
| Native screens from React DOM source | Use React Native with Expo and TypeScript by default, or extend the existing native project if one is present. Share portable contracts, business logic, and compatible assets. Read [Port and verify](references/port-and-verify.md#native-ui). |
| Explicit web wrapper | Use Capacitor to package the web client, with platform adapters for native integrations. Read [Capacitor wrapper](references/port-and-verify.md#capacitor-wrapper). |

For Agentik, start with `src/App.tsx`, `src/catalog.ts`, `src/services.ts`, `src/session.ts`, `src/state.ts`, `src/local-rooms.ts`, `src/components/Scene.tsx`, `scripts/offline-plugin.ts`, `server/`, and `docs/deployment.md` where present. Trace the landing page, access-code login, catalog, chat history, rooms, and offline flows. Verify which integrations are active in this revision. Keep local/demo behavior distinct from services that synchronize across devices.

Read [Service and state](references/port-and-verify.md#service-and-state) before implementing authenticated or offline flows. Keep access codes, signing material, API secrets, and service-role keys server-side or in authorized credential stores. For an implementation, prove the riskiest end-to-end flow on the target runtime early, then use [Build and verify](references/port-and-verify.md#build-and-verify) to match the artifact and evidence to the request.

For example, “native Android demo from `feat/mobile` with an installable APK” means pin the branch SHA, check the authorized test API, implement native screens, and verify a local APK with the agreed Metro dependency or standalone behavior. That request supports local debug signing. Store credentials and upload are separate steps.
