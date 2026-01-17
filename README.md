# MCP Server for Hono

Expose your [Hono](https://hono.dev) API endpoints as [MCP](https://modelcontextprotocol.io) tools.

## Usage

```ts
import { Hono } from "hono";
import { z } from "zod";
import { mcp, registerTool } from "hono-mcp-server";

const app = new Hono()
  .get("/users", registerTool("List all users"), (c) => c.json([{ id: 1, name: "Alice" }]))
  .get("/users/:id", registerTool("Get user by ID"), (c) => c.json({ id: c.req.param("id") }))
  .post(
    "/users",
    registerTool({
      description: "Create a new user",
      inputSchema: {
        name: z.string().describe("User's full name"),
        email: z.string().email().describe("User's email address"),
      },
    }),
    async (c) => {
      const { name } = c.req.valid("json"); // typed!
      return c.json({ id: 1, name });
    },
  );

export default mcp(app, {
  name: "Users API",
  version: "1.0.0",
});
```

This adds an `/mcp` endpoint that exposes your routes as MCP tools.

## Input & Output Schemas

Use `registerTool()` with `inputSchema` for validated, typed input. Access validated data with `c.req.valid('json')`:

```ts
import { z } from "zod";
import { registerTool } from "hono-mcp-server";

app.post(
  "/search",
  registerTool({
    description: "Search for items",
    inputSchema: {
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Max results"),
    },
    outputSchema: {
      results: z.array(z.object({ id: z.string(), title: z.string() })),
    },
  }),
  async (c) => {
    const { query, limit } = c.req.valid("json"); // typed!
    return c.json({ results: [] });
  },
);
```

When `outputSchema` is defined, the tool returns structured content that MCP clients can parse.

## Options

```ts
mcp(app, {
  name: "API Name", // required
  version: "1.0.0", // required
  description: "...", // optional
  instructions: "...", // optional
  mcpPath: "/mcp", // optional, default: "/mcp"
  codemode: false, // optional, see below
});
```

## Codemode

Instead of exposing individual routes as tools, codemode exposes `search` and `execute` tools for dynamic API interaction. Requires [Cloudflare Worker Loader](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/).

```ts
export default mcp(app, {
  name: "API",
  version: "1.0.0",
  codemode: true,
});
```

```jsonc
// wrangler.jsonc
{
  "worker_loaders": [{ "binding": "LOADER" }],
}
```
