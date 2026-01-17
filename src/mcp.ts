import { Hono } from "hono";
import type { Env, Handler } from "hono";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

const MCP_DESCRIPTION = Symbol("mcp_description");

/**
 * Add a description to a route handler for MCP tool generation.
 *
 * @example
 * ```ts
 * app.get('/users', describe('List all users', (c) => c.json([])))
 * ```
 */
export function describe<H extends Handler>(description: string, handler: H): H {
  (handler as any)[MCP_DESCRIPTION] = description;
  return handler;
}

function getDescription(handler: unknown): string | undefined {
  return (handler as any)?.[MCP_DESCRIPTION];
}

// WorkerLoader interface (matches @cloudflare/workers-types)
interface WorkerLoader {
  get(
    id: string,
    factory: () => {
      compatibilityDate: string;
      compatibilityFlags?: string[];
      mainModule: string;
      modules: Record<string, string>;
    },
  ): { getEntrypoint(): { evaluate: (...args: unknown[]) => Promise<unknown> } };
}

export interface McpOptions {
  name: string;
  version: string;
  title?: string;
  description?: string;
  instructions?: string;
  mcpPath?: string;
  /** Enable codemode - exposes search/execute tools instead of per-route tools. Requires LOADER binding. */
  codemode?: boolean;
  /** Binding name for Worker Loader (default: "LOADER"). Only used when codemode is true. */
  loaderBinding?: string;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Route {
  method: HttpMethod;
  path: string;
  description: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Wraps a Hono app to add an MCP endpoint that exposes routes as tools.
 *
 * @example
 * ```ts
 * import { mcp, describe } from 'hono-mcp'
 *
 * const app = new Hono()
 *   .get('/users', describe('List all users', (c) => c.json([])))
 *   .get('/users/:id', describe('Get user by ID', (c) => c.json({ id: c.req.param('id') })));
 *
 * export default mcp(app, { name: 'Users API', version: '1.0.0' });
 * ```
 *
 * @example Codemode (requires Worker Loader binding)
 * ```ts
 * export default mcp(app, { name: 'API', version: '1.0.0', codemode: true });
 * ```
 *
 */
export function mcp<E extends Env>(app: Hono<E>, options: McpOptions): Hono<E> {
  const { mcpPath = "/mcp", codemode = false, loaderBinding = "LOADER" } = options;
  const routes = extractRoutes(app);
  const serverInfo = {
    name: options.name,
    version: options.version,
    ...(options.title && { title: options.title }),
    ...(options.description && { description: options.description }),
  };

  const createServer = () =>
    new McpServer(
      serverInfo,
      options.instructions
        ? { instructions: options.instructions }
        : codemode
          ? {
              instructions:
                "Use 'search' to find available endpoints, then 'execute' to run code against the API.",
            }
          : undefined,
    );

  const handleMcp = codemode
    ? async (c: any) => {
        if (c.req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

        const loader = c.env?.[loaderBinding] as WorkerLoader | undefined;
        if (!loader) {
          return new Response(
            `Codemode requires ${loaderBinding} binding. Add worker_loaders to wrangler.jsonc.`,
            { status: 500 },
          );
        }

        const server = createServer();
        registerCodemodeTools(server, routes, app, loader);

        const transport = new WebStandardStreamableHTTPServerTransport();
        server.connect(transport);
        return withCors(await transport.handleRequest(c.req.raw));
      }
    : async (c: any) => {
        if (c.req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

        const server = createServer();
        for (const route of routes) registerTool(server, route, app);

        const transport = new WebStandardStreamableHTTPServerTransport();
        server.connect(transport);
        return withCors(await transport.handleRequest(c.req.raw));
      };

  app.all(`${mcpPath}/*`, handleMcp);
  app.all(mcpPath, handleMcp);

  return app;
}

function extractRoutes(app: Hono<any>): Route[] {
  const routes: Route[] = [];
  const seen = new Set<string>();

  const honoRoutes = (app as any).routes as Array<{
    path: string;
    method: string;
    handler: Function;
  }>;

  if (!honoRoutes) return routes;

  for (const route of honoRoutes) {
    const method = route.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) continue;
    if (route.path.startsWith("/mcp")) continue;

    const key = `${method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const description = getDescription(route.handler) || generateDescription(method, route.path);
    routes.push({ method: method as HttpMethod, path: route.path, description });
  }

  return routes;
}

function generateDescription(method: string, path: string): string {
  const resource =
    path
      .split("/")
      .filter((p) => p && !p.startsWith(":"))
      .pop() || "resource";
  const action =
    {
      GET: path.includes(":") ? "Get" : "List",
      POST: "Create",
      PUT: "Update",
      PATCH: "Update",
      DELETE: "Delete",
    }[method] || method;
  return `${action} ${resource}`;
}

function generateToolName(method: string, path: string): string {
  const cleanPath = path
    .replace(/^\//, "")
    .replace(/\/:([^/]+)/g, "_by_$1")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
  return `${method.toLowerCase()}_${cleanPath || "root"}`;
}

function extractPathParams(path: string): string[] {
  const matches = path.match(/:([^/]+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

function registerTool(server: McpServer, route: Route, app: Hono<any>): void {
  const toolName = generateToolName(route.method, route.path);
  const pathParams = extractPathParams(route.path);

  const inputShape: Record<string, z.ZodType> = {};
  for (const param of pathParams) {
    inputShape[param] = z.string().describe(`Path parameter: ${param}`);
  }
  if (["POST", "PUT", "PATCH"].includes(route.method)) {
    inputShape["body"] = z.record(z.unknown()).optional().describe("Request body as JSON object");
  }
  if (["GET", "DELETE"].includes(route.method)) {
    inputShape["query"] = z.record(z.string()).optional().describe("Query parameters");
  }

  server.registerTool(
    toolName,
    {
      description: `${route.description}\n\n${route.method} ${route.path}`,
      inputSchema: Object.keys(inputShape).length > 0 ? inputShape : undefined,
    },
    async (params: Record<string, unknown>) => {
      let url = route.path;
      for (const param of pathParams) {
        const value = params[param];
        if (value !== undefined) {
          url = url.replace(`:${param}`, encodeURIComponent(String(value)));
        }
      }

      const query = params["query"] as Record<string, string> | undefined;
      if (query && Object.keys(query).length > 0) {
        url = `${url}?${new URLSearchParams(query).toString()}`;
      }

      const body = params["body"] as Record<string, unknown> | undefined;
      const init: RequestInit = {
        method: route.method,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      };
      if (body && ["POST", "PUT", "PATCH"].includes(route.method)) {
        init.body = JSON.stringify(body);
      }

      try {
        const response = await app.fetch(new Request(`http://internal${url}`, init));
        const contentType = response.headers.get("content-type") || "";
        const text = contentType.includes("application/json")
          ? JSON.stringify(await response.json(), null, 2)
          : await response.text();
        return { content: [{ type: "text" as const, text }], isError: !response.ok };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// Codemode: search and execute tools
interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  body?: string;
}

function routesToApiSchema(routes: Route[]): ApiEndpoint[] {
  return routes.map((route) => {
    const endpoint: ApiEndpoint = {
      method: route.method,
      path: route.path,
      description: route.description,
    };
    if (["POST", "PUT", "PATCH"].includes(route.method)) {
      endpoint.body = "JSON object";
    }
    return endpoint;
  });
}

async function executeSearch(
  loader: WorkerLoader,
  code: string,
  apiSchema: ApiEndpoint[],
): Promise<{ result?: unknown; error?: string }> {
  const workerId = `search-${crypto.randomUUID()}`;

  const worker = loader.get(workerId, () => ({
    compatibilityDate: "2026-01-14",
    compatibilityFlags: ["nodejs_compat"],
    mainModule: "worker.js",
    modules: {
      "worker.js": `
        import { WorkerEntrypoint } from "cloudflare:workers";
        const endpoints = ${JSON.stringify(apiSchema)};
        export default class SearchExecutor extends WorkerEntrypoint {
          async evaluate() {
            try {
              const result = await (${code})();
              return { result };
            } catch (err) {
              return { error: err.message };
            }
          }
        }
      `,
    },
  }));

  const entrypoint = worker.getEntrypoint();
  return (await entrypoint.evaluate()) as { result?: unknown; error?: string };
}

async function executeCode(
  loader: WorkerLoader,
  code: string,
  app: Hono<any>,
): Promise<{ result?: unknown; error?: string }> {
  const workerId = `execute-${crypto.randomUUID()}`;

  const worker = loader.get(workerId, () => ({
    compatibilityDate: "2026-01-14",
    compatibilityFlags: ["nodejs_compat"],
    mainModule: "worker.js",
    modules: {
      "worker.js": `
        import { WorkerEntrypoint } from "cloudflare:workers";

        export default class ExecuteWorker extends WorkerEntrypoint {
          async evaluate(fetch) {
            try {
              const result = await (${code})();
              return { result };
            } catch (err) {
              return { error: err.message };
            }
          }
        }
      `,
    },
  }));

  const fetch = async (path: string, options: RequestInit = {}) => {
    const response = await app.fetch(new Request(`http://internal${path}`, options));
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json") ? response.json() : response.text();
  };

  const entrypoint = worker.getEntrypoint();
  return (await entrypoint.evaluate(fetch)) as { result?: unknown; error?: string };
}

function registerCodemodeTools(
  server: McpServer,
  routes: Route[],
  app: Hono<any>,
  loader: WorkerLoader,
): void {
  const apiSchema = routesToApiSchema(routes);

  // Search tool - discover available endpoints
  server.registerTool(
    "search",
    {
      description: `Search available API endpoints.

Available in your code:
  const endpoints = [...] // Array of { method, path, description, body? }

Example:
  async () => endpoints.filter(e => e.path.includes('users'))`,
      inputSchema: {
        code: z.string().describe("JavaScript async arrow function to search endpoints"),
      },
    },
    async ({ code }) => {
      const result = await executeSearch(loader, code as string, apiSchema);
      if (result.error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result.result, null, 2) }] };
    },
  );

  // Execute tool - run code against the API
  server.registerTool(
    "execute",
    {
      description: `Execute code against the API.

Types:
  interface RequestInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
  declare function fetch(path: string, options?: RequestInit): Promise<unknown>;

Example:
  async () => await fetch('/users')`,
      inputSchema: { code: z.string().describe("JavaScript async arrow function to execute") },
    },
    async ({ code }) => {
      const result = await executeCode(loader, code as string, app);
      if (result.error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result.result, null, 2) }] };
    },
  );
}
