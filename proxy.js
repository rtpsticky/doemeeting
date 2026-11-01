import { NextResponse } from "next/server";

// CORS สำหรับ front-end ที่อยู่คนละโดเมน (เช่น Cloudflare Pages)
// กำหนด origin ที่อนุญาตใน env CORS_ALLOWED_ORIGINS คั่นด้วย comma รองรับ wildcard subdomain
// เช่น CORS_ALLOWED_ORIGINS="https://doemeeting.pages.dev,https://*.doemeeting.pages.dev,http://localhost:5173"
// ไม่ได้เปิด Allow-Credentials เพราะ front-end แยกใช้ Authorization: Bearer แทน cookie

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization";

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean)
  .map((origin) => {
    if (!origin.includes("*")) return origin;
    const pattern = origin
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join("[a-z0-9-]+");
    return new RegExp(`^${pattern}$`, "i");
  });

function isAllowedOrigin(origin) {
  return allowedOrigins.some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin),
  );
}

function setCorsHeaders(headers, origin) {
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
  headers.append("Vary", "Origin");
}

export function proxy(request) {
  const origin = request.headers.get("origin");
  const allowed = origin && isAllowedOrigin(origin);

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: allowed ? 204 : 403 });
    if (allowed) setCorsHeaders(response.headers, origin);
    return response;
  }

  const response = NextResponse.next();
  if (allowed) setCorsHeaders(response.headers, origin);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
