import { Hono } from "hono";
import { mcp, describe } from "hono-mcp-server";

// Define the API
const app = new Hono()
  .get(
    "/users",
    describe("List all users", (c) =>
      c.json([
        { id: 1, name: "Alice", email: "alice@example.com" },
        { id: 2, name: "Bob", email: "bob@example.com" },
      ])),
  )
  .get(
    "/users/:id",
    describe("Get user by ID", (c) => {
      const id = c.req.param("id");
      return c.json({ id: Number(id), name: "Alice", email: "alice@example.com" });
    }),
  )
  .post(
    "/users",
    describe("Create a new user", async (c) => {
      const body = await c.req.json();
      return c.json({ id: 3, ...body }, 201);
    }),
  )
  .delete(
    "/users/:id",
    describe("Delete a user", (c) => {
      const id = c.req.param("id");
      return c.json({ deleted: true, id: Number(id) });
    }),
  )
  .get("/", (c) =>
    c.json({
      name: "Codemode Example",
      api: "/users",
      mcp: "/mcp",
      mode: "codemode - search and execute tools",
    }),
  );

// Export with codemode enabled - exposes search/execute tools instead of per-route tools
export default mcp(app, {
  name: "Users API (Codemode)",
  version: "1.0.0",
  codemode: true,
});
