import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/team-db";

export async function GET(request: Request) {
  const session = await getSessionUser(request);

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.username,
    role: session.role,
  });
}
