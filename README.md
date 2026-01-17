# MCP Server for Hono

Expose your [Hono](https://hono.dev) API endpoints as [MCP](https://modelcontextprotocol.io) tools.

## Usage

```ts
import { Hono } from "hono";
import { mcp, describe } from "hono-mcp-server";

const app = new Hono()
  .get(
    "/users",
    describe("List all users", (c) => c.json([{ id: 1, name: "Alice" }])),
  )
  .get(
    "/users/:id",
    describe("Get user by ID", (c) => c.json({ id: c.req.param("id") })),
  )
  .post(
    "/users",
    describe("Create a user", async (c) => c.json(await c.req.json(), 201)),
  );

export default mcp(app, {
  name: "Users API",
  version: "1.0.0",
});
```

This adds an `/mcp` endpoint that exposes your routes as MCP tools.

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
