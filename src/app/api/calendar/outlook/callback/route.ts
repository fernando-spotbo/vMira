import { NextRequest } from "next/server";
import { handleCalendarCallback } from "@/lib/calendar-callback";

export async function GET(req: NextRequest) {
  return handleCalendarCallback(req, "outlook");
}
