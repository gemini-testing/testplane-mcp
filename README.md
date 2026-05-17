<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.svg" width="300">
        <source media="(prefers-color-scheme: light)" srcset="docs/images/logo-light.svg" width="300">
        <img alt="html-reporter logo" src="docs/images/logo-light.svg" width="300">
    </picture>
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@testplane/mcp"><img src="https://img.shields.io/npm/d18m/@testplane/mcp.svg" alt="Total Downloads"></a>
    <a href="https://testplane.io"><img src="https://img.shields.io/badge/Docs-Website-6c47ff" alt="Documentation"></a>
    <a href="https://www.npmjs.com/package/@testplane/mcp"><img src="https://img.shields.io/npm/v/@testplane/mcp.svg" alt="Latest Release"></a>
    <a href="https://github.com/gemini-testing/testplane-mcp/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@testplane/mcp.svg" alt="License"></a>
    <a href="https://t.me/testplane"><img src="https://img.shields.io/badge/community-chat-blue?logo=telegram" alt="Community Chat"></a>
</p>

A collection of AI integrations for Testplane, which enables agents to interact with browsers and web apps through Testplane APIs.

### What can you do with Testplane AI Integrations?

- Automate generation of integration/e2e tests with LLM-based agents
- AI Agents no longer have to take guesses as to how your app works — they can truly see what's happening inside a browser and write quality tests for you
- Let LLMs use text-based or visual-based snapshots, depending on what works better for your app

### Testplane CLI

Testplane CLI is a command line interface for inspecting and controlling a browser from your terminal. It makes possible to perform any browser interactions, inspect HTML Reports and Time Travel snapshots, use REPL mode to debug failing tests and more.

Read [full documentation](./packages/cli/README.md) to learn more.

### Testplane MCP

Testplane MCP is a [Model Context Protocol server](https://modelcontextprotocol.io/quickstart/user) for Testplane, which has the same capabilities as Testplane CLI and allows LLMs to "see" and interact with any web app.

Read [full documentation](./packages/mcp/README.md) to learn more.
