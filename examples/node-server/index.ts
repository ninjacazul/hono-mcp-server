import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { mcp, registerTool } from "hono-mcp-server";

const app = new Hono()
  .get("/", (c) =>
    c.json({
      name: "Users API",
      endpoints: ["/users", "/users/:id"],
      mcp: "/mcp",
    }),
  )
  .get(
    "/users",
    registerTool({
      description: "List all users in the system",
      outputSchema: {
        users: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            email: z.string(),
          }),
        ),
      },
    }),
    (c) =>
      c.json({
        users: [
          { id: 1, name: "Alice", email: "alice@example.com" },
          { id: 2, name: "Bob", email: "bob@example.com" },
        ],
      }),
  )
  .get(
    "/users/:id",
    registerTool("Get a specific user by their ID"),
    (c) => {
      const id = c.req.param("id");
      return c.json({ id: Number(id), name: "Alice", email: "alice@example.com" });
    },
  )
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
      const { name, email } = c.req.valid("json");
      return c.json({ id: 3, name, email }, 201);
    },
  )
  .delete(
    "/users/:id",
    registerTool("Delete a user"),
    (c) => {
      const id = c.req.param("id");
      return c.json({ deleted: true, id: Number(id) });
    },
  );

const server = mcp(app, {
  name: "Users API",
  version: "1.0.0",
  description: "A simple users CRUD API",
});

const port = 3000;
console.log(`Server running at http://localhost:${port}`);
console.log(`MCP endpoint at http://localhost:${port}/mcp`);

serve({ fetch: server.fetch, port });
