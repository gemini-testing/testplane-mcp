<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.svg" width="300">
        <source media="(prefers-color-scheme: light)" srcset="docs/images/logo-light.svg" width="300">
        <img alt="html-reporter logo" src="docs/images/logo-light.svg" width="300">
    </picture>
</p>

<p align="center">
    <a href="https://testplane.io"><img src="https://img.shields.io/badge/Docs-Website-6c47ff" alt="Total Downloads"></a>
    <a href="https://www.npmjs.com/package/@testplane/mcp"><img src="https://img.shields.io/npm/v/@testplane/mcp.svg" alt="Latest Release"></a>
    <a href="https://github.com/gemini-testing/testplane-mcp/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@testplane/mcp.svg" alt="License"></a>
    <a href="https://t.me/testplane"><img src="https://img.shields.io/badge/community-chat-blue?logo=telegram" alt="Community Chat"></a>
</p>

A [Model Context Protocol server](https://modelcontextprotocol.io/quickstart/user) for Testplane, which enables LLMs to "see" and interact with any web app.

### What you can do with Testplane MCP?
- Automate generation of integration/e2e tests with LLM-based agents
- AI Agents no longer have to take guesses as to how your app works — they can truly see what's happening inside a browser and write quality tests for you
- Let LLMs use text-based or visual-based snapshots, depending on what works better for your app

### Getting started

1. You need Node 18+ and a compatible MCP host (like Claude Desktop, Cursor or Windsurf).

2. Add Testplane MCP to MCP host of your choice. This is a typical configuration:

    ```json
    {
        "command": "npx",
        "args": ["@testplane/mcp@latest"],
    }
    ```

    <details>
    <summary>Set up in Cursor</summary>

    Open Cursor `Settings` (button at the top right corner of the screen), find `MCP` section, click on the `Add new global MCP server` button, edit the config to include Testplane MCP as seen below.

    ```json
    {
        "mcpServers": {
            "testplane-mcp": {
                "command": "npx",
                "args": ["@testplane/mcp@latest"]
            }
        }
    }
    ```
    </details>

    <details>
    <summary>Set up in VS Code</summary>

    Open VS Code `Settings`, search for `MCP`, click `Edit in settings.json`, edit the config to include Testplane MCP as seen below.

    ```json
    {
        "mcp": {
            "inputs": [],
            "servers": {
                "testplane-mcp": {
                    "command": "npx",
                    "args": ["@testplane/mcp@latest"]
                }
            }
        }
    }
    ```
    </details>

    <details>
    <summary>Set up in Claude Desktop</summary>

    Use [official docs](https://modelcontextprotocol.io/quickstart/user) to open config, then edit the config to include Testplane MCP as seen below.

    ```json
    {
        "mcpServers": {
            "testplane-mcp": {
                "command": "npx",
                "args": ["@testplane/mcp@latest"]
            }
        }
    }
    ```
    </details>

    <details>
    <summary>Set up in Windsurf</summary>

    Follow the [official docs](https://docs.windsurf.com/windsurf/cascade/mcp) to open MCP settings, then edit the config to include Testplane MCP as seen below.

    ```json
    {
        "mcpServers": {
            "testplane-mcp": {
                "command": "npx",
                "args": ["@testplane/mcp@latest"]
            }
        }
    }
    ```
    </details>

    <details>
    <summary>Set up in Jetbrains IDE</summary>

    Follow the [official docs](https://www.jetbrains.com/help/ai-assistant/configure-an-mcp-server.html) to open MCP settings, then edit the config to include Testplane MCP as seen below.

    ```json
    {
        "mcpServers": {
            "testplane-mcp": {
                "command": "npx",
                "args": ["@testplane/mcp@latest"]
            }
        }
    }
    ```
    </details>

## Available Tools

<details>
<summary>Navigation</summary>

### `navigate`
Open a URL in the browser.
- **Parameters:**
  - `url` (string, required): The URL to navigate to

</details>

<details>
<summary>Browser Management</summary>

### `closeBrowser`
Close the current browser session.

</details>
