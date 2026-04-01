import { NextRequest, NextResponse } from "next/server";

const PLATFORM_URL = "https://platform.vmira.ai";

// Routes that exist under /platform in the file system
const PLATFORM_ROUTES = ["/dashboard", "/usage", "/billing", "/api-keys", "/docs", "/pricing"];

function isPlatformRoute(pathname: string): boolean {
  return PLATFORM_ROUTES.some(route => pathname === route || pathname.startsWith(route + "/"));
}

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const { pathname, search } = request.nextUrl;

  const isPlatformSubdomain = hostname.startsWith("platform.");
  const isLocalhost = hostname.startsWith("localhost") || hostname.startsWith("127.0.0.1");
  const isDocsSubdomain = hostname === "docs.vmira.ai";

  // docs.vmira.ai/* → platform.vmira.ai/docs/*
  if (isDocsSubdomain) {
    const docsPath = pathname === "/" ? "/docs" : `/docs${pathname}`;
    return NextResponse.redirect(new URL(docsPath, PLATFORM_URL), 301);
  }

  // Platform subdomain OR localhost: rewrite clean paths to /platform/* internally
  if (isPlatformSubdomain || isLocalhost) {
    if (isPlatformSubdomain && pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/platform/dashboard";
      return NextResponse.rewrite(url);
    }
    if (isPlatformRoute(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = `/platform${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Main domain (production): redirect /platform/*, /authorize, /docs to subdomain
  if (pathname.startsWith("/docs")) {
    return NextResponse.redirect(new URL(pathname, PLATFORM_URL), 301);
  }
  if (pathname.startsWith("/platform")) {
    const platformPath = pathname.replace("/platform", "") || "/dashboard";
    return NextResponse.redirect(`${PLATFORM_URL}${platformPath}${search}`);
  }
  if (pathname === "/authorize" || pathname.startsWith("/authorize")) {
    return NextResponse.redirect(`${PLATFORM_URL}${pathname}${search}`);
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon\\.svg).*)"],
};
