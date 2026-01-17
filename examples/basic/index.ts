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
  // With output schema for structured responses
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
  // Simple description
  .get(
    "/users/:id",
    registerTool("Get a specific user by their ID"),
    (c) => {
      const id = c.req.param("id");
      return c.json({ id: Number(id), name: "Alice", email: "alice@example.com" });
    },
  )
  // With inputSchema - use c.req.valid('json') for typed input
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
      const { name, email } = c.req.valid("json"); // typed!
      return c.json({ id: 3, name, email }, 201);
    },
  )
  // With both inputSchema and outputSchema
  .put(
    "/users/:id",
    registerTool({
      description: "Update an existing user",
      inputSchema: {
        name: z.string().optional().describe("User's full name"),
        email: z.string().email().optional().describe("User's email address"),
      },
      outputSchema: {
        id: z.number(),
        name: z.string(),
        email: z.string(),
      },
    }),
    async (c) => {
      const id = c.req.param("id");
      const { name, email } = c.req.valid("json"); // typed!
      return c.json({ id: Number(id), name: name ?? "", email: email ?? "" });
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

export default mcp(app, {
  name: "Users API",
  version: "1.0.0",
  description: "A simple users CRUD API",
});
