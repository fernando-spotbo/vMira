import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const path = request.nextUrl.pathname;

  // docs.vmira.ai/* → platform.vmira.ai/docs/*
  if (host === "docs.vmira.ai") {
    const docsPath = path === "/" ? "/docs" : `/docs${path}`;
    return NextResponse.redirect(new URL(docsPath, "https://platform.vmira.ai"), 301);
  }

  // vmira.ai/docs/* → platform.vmira.ai/docs/*
  if (path.startsWith("/docs") && host === "vmira.ai") {
    return NextResponse.redirect(new URL(path, "https://platform.vmira.ai"), 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/docs/:path*", "/:path*"],
};
