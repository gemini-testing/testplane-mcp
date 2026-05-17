<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.svg" width="300">
        <source media="(prefers-color-scheme: light)" srcset="docs/images/logo-light.svg" width="300">
        <img alt="Testplane CLI logo" src="docs/images/logo-light.svg" width="300">
    </picture>
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@testplane/cli"><img src="https://img.shields.io/npm/d18m/@testplane/cli.svg" alt="Total Downloads"></a>
    <a href="https://testplane.io/docs/v8/ai/toolkit/testplane-cli/"><img src="https://img.shields.io/badge/Docs-Website-6c47ff" alt="Documentation"></a>
    <a href="https://www.npmjs.com/package/@testplane/cli"><img src="https://img.shields.io/npm/v/@testplane/cli.svg" alt="Latest Release"></a>
    <a href="https://github.com/gemini-testing/testplane-mcp/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@testplane/cli.svg" alt="License"></a>
    <a href="https://t.me/testplane"><img src="https://img.shields.io/badge/community-chat-blue?logo=telegram" alt="Community Chat"></a>
</p>

Testplane CLI is a command line interface for inspecting and controlling a browser from your terminal. It makes possible to perform any browser interactions, inspect HTML Reports and Time Travel snapshots, use REPL mode to debug failing tests and more.

Read the [full Testplane CLI documentation](https://testplane.io/docs/v8/ai/toolkit/testplane-cli/).

### Installation

Install globally:

```bash
npm install -g @testplane/cli
```

Or run it without installing:

```bash
npx @testplane/cli@latest --help
```

### Examples

Open a page and capture a DOM snapshot:

```bash
testplane-cli navigate https://example.com
testplane-cli snapshot
```

Interact with the current page:

```bash
testplane-cli click --role button --name "Submit"
testplane-cli type "#email" --value user@example.com
```

Run custom Testplane code against the active browser session:

```bash
testplane-cli run-code "await browser.getUrl()"
testplane-cli run-code --file ./scripts/check-page.js
```

### Capabilities

Testplane CLI runs a reusable local daemon for each project, so commands can share the same browser session across terminal invocations.

- Various browser interactions: navigate pages, click and type into elements, manage tabs, read console output, take screenshots, and inspect DOM or visual state.
- HTML reporter integration: open reports and inspect captured time travel snapshots.
- REPL mode integration for interactive browser exploration from the terminal.
- Save and restore browser state to handle authenticated flows.
- Run arbitrary Testplane code when built-in commands are not enough.
