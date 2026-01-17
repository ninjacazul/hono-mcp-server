import { Hono } from "hono";
import { mcp, describe } from "hono-mcp-server";

// Create your API with inline descriptions using describe()
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
    describe("List all users in the system", (c) =>
      c.json([
        { id: 1, name: "Alice", email: "alice@example.com" },
        { id: 2, name: "Bob", email: "bob@example.com" },
      ])),
  )
  .get(
    "/users/:id",
    describe("Get a specific user by their ID", (c) => {
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
  .put(
    "/users/:id",
    describe("Update an existing user", async (c) => {
      const id = c.req.param("id");
      const body = await c.req.json();
      return c.json({ id: Number(id), ...body });
    }),
  )
  .delete(
    "/users/:id",
    describe("Delete a user", (c) => {
      const id = c.req.param("id");
      return c.json({ deleted: true, id: Number(id) });
    }),
  );

// That's it! Wrap with mcp() and you get /mcp endpoint
export default mcp(app, {
  name: "Users API",
  version: "1.0.0",
  description: "A simple users CRUD API",
});
