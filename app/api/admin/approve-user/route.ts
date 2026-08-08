import { NextResponse } from "next/server";
import {
  addAuditLog,
  approveUserById,
  getSessionUser,
  rejectUserById,
} from "@/lib/team-db";

export async function POST(request: Request) {
  const session = await getSessionUser(request);

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json();
  const userId = Number(body?.userId);
  const action = body?.action === "reject" ? "reject" : "approve";

  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  if (action === "approve") {
    await approveUserById(userId);
    await addAuditLog(session.username, session.role, "approve_user", {
      userId,
    });
  } else {
    await rejectUserById(userId);
    await addAuditLog(session.username, session.role, "reject_user", {
      userId,
    });
  }

  return NextResponse.json({ success: true });
}
