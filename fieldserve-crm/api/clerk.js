import https from "node:https";

const CLERK_FRONTEND_API_HOST = "frontend-api.clerk.dev";
const CLERK_PROXY_URL = "https://fieldserve.vercel.app/__clerk";

export default function handler(request, response) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    response.status(500).json({ error: "Clerk proxy is not configured." });
    return;
  }

  const incomingUrl = new URL(request.url, "https://fieldserve.vercel.app");
  const targetPath = incomingUrl.searchParams.get("path") ?? "";
  incomingUrl.searchParams.delete("path");
  const targetUrl = `/${targetPath}${incomingUrl.search}`;
  const forwardedFor = request.headers["x-forwarded-for"] ?? request.socket.remoteAddress ?? "";
  const headers = {
    ...request.headers,
    host: CLERK_FRONTEND_API_HOST,
    "clerk-proxy-url": CLERK_PROXY_URL,
    "clerk-secret-key": secretKey,
    "x-forwarded-for": forwardedFor,
  };

  const proxyRequest = https.request(
    {
      hostname: CLERK_FRONTEND_API_HOST,
      method: request.method,
      path: targetUrl,
      headers,
    },
    (proxyResponse) => {
      response.statusCode = proxyResponse.statusCode ?? 502;
      for (const [name, value] of Object.entries(proxyResponse.headers)) {
        if (value === undefined || name === "transfer-encoding") continue;
        if (name === "location" && typeof value === "string") {
          response.setHeader(name, value.replace(`https://${CLERK_FRONTEND_API_HOST}`, CLERK_PROXY_URL));
        } else {
          response.setHeader(name, value);
        }
      }
      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on("error", () => {
    if (!response.headersSent) {
      response.status(502).json({ error: "Clerk proxy request failed." });
    } else {
      response.end();
    }
  });
  request.pipe(proxyRequest);
}