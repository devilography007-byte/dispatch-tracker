import { NextResponse } from "next/server";
import { getDatabase, parseCookieValue } from "@/lib/team-db";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const token = parseCookieValue(cookieHeader, "dispatch_session");

  if (token) {
    const db = getDatabase();
    db.prepare("DELETE FROM sessions WHERE id = ?").run(token);
    db.close();
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "dispatch_session",
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
