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

### What can you do with Testplane MCP?

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

    Open Cursor `Settings` (button at the top right corner of the screen), find `Tools & Integrations` section, click on the `New MCP Server` button, edit the config to include Testplane MCP as seen below.

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
Navigate to URL in the browser.
- **Parameters:**
  - `url` (string, required): The URL to navigate to

</details>

<details>
<summary>Browser Management</summary>

### `closeBrowser`
Close the current browser session.

</details>

<details>
<summary>Tabs</summary>

### `listTabs`
Get a list of all currently opened browser tabs with their URLs, titles, and active status.

### `switchToTab`
Switch to a specific browser tab by its number (starting from 1).
- **Parameters:**
  - `tabNumber` (number, required): The number of the tab to switch to (starting from 1)

### `openNewTab`
Open a new browser tab, optionally navigate to a URL, and automatically switch to it.
- **Parameters:**
  - `url` (string, optional): The URL to navigate to in the new tab. If not provided, opens a blank tab

### `closeTab`
Close a specific browser tab by its number (1-based), or close the current tab if no number is provided.
- **Parameters:**
  - `tabNumber` (number, optional): The number of the tab to close (starting from 1). If not provided, closes the current tab

**Note:** Cannot close the last remaining tab. `closeBrowser` should be used to close the entire browser session.

</details>

<details>
<summary>Element Interaction</summary>

### `clickOnElement`
Click an element on the page using semantic queries (`testing-library`-style) or CSS selectors.

- **Parameters:**
  - `locator` (object, required): Element location strategy
    - `strategy` (string, required): Either `"testing-library"` or `"webdriverio"`
    
    For **testing-library strategy**:
    - `queryType` (string, required): Semantic query type. One of:
        - `"role"` - Find by ARIA role (e.g., "button", "link", "heading")
        - `"text"` - Find by visible text content
        - `"labelText"` - Find form inputs by their label text
        - `"placeholderText"` - Find inputs by placeholder text
        - `"altText"` - Find images by alt text
        - `"testId"` - Find by data-testid attribute
        - `"title"` - Find by title attribute
        - `"displayValue"` - Find inputs by their current value
    - `queryValue` (string, required): The value to search for
    - `queryOptions` (object, optional): Additional options:
        - `name` (string): Accessible name for role queries
        - `exact` (boolean): Whether to match exact text (default: true)
        - `hidden` (boolean): Include hidden elements (default: false)
        - `level` (number): Heading level for role="heading" (1-6)
    
    For **webdriverio strategy**:
    - `selector` (string, required): CSS selector, XPath or WebdriverIO locator

**Examples:**
```javascript
// Testing Library strategy
{
  locator: {
    strategy: "testing-library",
    queryType: "role",
    queryValue: "button",
    queryOptions: { name: "Submit" }
  }
}

{
  locator: {
    strategy: "testing-library",
    queryType: "text",
    queryValue: "Click here"
  }
}

{
  locator: {
    strategy: "testing-library",
    queryType: "labelText",
    queryValue: "Email Address"
  }
}

// WebdriverIO strategy
{
  locator: {
    strategy: "webdriverio",
    selector: ".submit-btn"
  }
}

{
  locator: {
    strategy: "webdriverio",
    selector: "button*=Submit"
  }
}
```

### `typeIntoElement`
Type text into an input element on the page using semantic queries (`testing-library`-style) or CSS selectors.

- **Parameters:**
  - `locator` (object, required): Element location strategy
    - `strategy` (string, required): Either `"testing-library"` or `"webdriverio"`
    
    For **testing-library strategy**:
    - `queryType` (string, required): Semantic query type. One of:
        - `"role"` - Find by ARIA role (e.g., "textbox", "searchbox")
        - `"text"` - Find by visible text content
        - `"labelText"` - Find form inputs by their label text
        - `"placeholderText"` - Find inputs by placeholder text
        - `"altText"` - Find images by alt text
        - `"testId"` - Find by data-testid attribute
        - `"title"` - Find by title attribute
        - `"displayValue"` - Find inputs by their current value
    - `queryValue` (string, required): The value to search for
    - `queryOptions` (object, optional): Additional options:
        - `name` (string): Accessible name for role queries
        - `exact` (boolean): Whether to match exact text (default: true)
        - `hidden` (boolean): Include hidden elements (default: false)
    
    For **webdriverio strategy**:
    - `selector` (string, required): CSS selector or XPath
    
  - `text` (string, required): The text to type into the element

**Examples:**

See above in the `clickOnElement` tool.

### `waitForElement`
Wait for an element to appear or disappear on the page. Useful for waiting until page loads fully or loading spinners disappear.

- **Parameters:**
  - `locator` (object, required): Element location strategy
    - `strategy` (string, required): Either `"testing-library"` or `"webdriverio"`
    
    For **testing-library strategy**:
    - `queryType` (string, required): Semantic query type. One of:
        - `"role"` - Find by ARIA role (e.g., "button", "link", "heading")
        - `"text"` - Find by visible text content
        - `"labelText"` - Find form inputs by their label text
        - `"placeholderText"` - Find inputs by placeholder text
        - `"altText"` - Find images by alt text
        - `"testId"` - Find by data-testid attribute
        - `"title"` - Find by title attribute
        - `"displayValue"` - Find inputs by their current value
    - `queryValue` (string, required): The value to search for
    - `queryOptions` (object, optional): Additional options:
        - `name` (string): Accessible name for role queries
        - `exact` (boolean): Whether to match exact text (default: true)
        - `hidden` (boolean): Include hidden elements (default: false)
        - `level` (number): Heading level for role="heading" (1-6)
    
    For **webdriverio strategy**:
    - `selector` (string, required): CSS selector or XPath
    
  - `disappear` (boolean, optional): Whether to wait for element to disappear. Default: false (wait for element to appear)
  - `timeout` (number, optional): Maximum time to wait in milliseconds. Default: 3000
  - `includeSnapshotInResponse` (boolean, optional): Whether to include page snapshot in response. Default: true

**Examples:**

See above in the `clickOnElement` tool.

</details>

<details>
<summary>Page Inspection</summary>

### `takePageSnapshot`
Capture a DOM snapshot of the current page with configurable filtering options.

- **Parameters:**
  - `includeTags` (array of strings, optional): HTML tags to include in the snapshot besides defaults
  - `includeAttrs` (array of strings, optional): HTML attributes to include in the snapshot besides defaults
  - `excludeTags` (array of strings, optional): HTML tags to exclude from the snapshot
  - `excludeAttrs` (array of strings, optional): HTML attributes to exclude from the snapshot
  - `truncateText` (boolean, optional): Whether to truncate long text content (default: true)
  - `maxTextLength` (number, optional): Maximum length of text content before truncation

**Note:** By default, only useful tags and attributes are included in snapshots. The response will indicate what was omitted. Use the filtering options only if you need specific content that's not included by default.

</details>
