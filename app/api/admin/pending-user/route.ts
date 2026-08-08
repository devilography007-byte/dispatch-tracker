import { NextResponse } from "next/server";
import { getPendingUsers, getSessionUser } from "@/lib/team-db";

export async function GET(request: Request) {
  const session = await getSessionUser(request);

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const pending = await getPendingUsers();
  return NextResponse.json({ pending });
}
