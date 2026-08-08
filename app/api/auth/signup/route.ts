import { NextResponse } from "next/server";
import {
  addAuditLog,
  createUserRecord,
  getDatabase,
  normalizeRole,
  randomSessionToken,
} from "@/lib/team-db";

export async function POST(request: Request) {
  const body = await request.json();
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  let newUser;
  try {
    newUser = await createUserRecord(username, password);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await addAuditLog(
    newUser.username,
    normalizeRole(newUser.role),
    newUser.approved ? "signup" : "signup_pending",
    { username: newUser.username }
  );

  // Not approved yet — do NOT log them in. They need to wait for an admin.
  if (!newUser.approved) {
    return NextResponse.json({
      success: true,
      pending: true,
      message:
        "Account created. An admin needs to approve your access before you can sign in.",
    });
  }

  // Only true for the very first account ever created (auto-admin).
  const token = `dispatch_${randomSessionToken()}`;
  const expiresAt = new Date(
    Date.now() + 12 * 60 * 60 * 1000
  ).toISOString();

  const db = await getDatabase();
  await db.execute({
    sql: `
      INSERT INTO sessions (id, username, expires_at)
      VALUES (?, ?, ?)
    `,
    args: [token, newUser.username, expiresAt],
  });

  const response = NextResponse.json({
    success: true,
    pending: false,
    user: newUser.username,
    role: newUser.role,
  });

  response.cookies.set({
    name: "dispatch_session",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60,
  });

  return response;
}
