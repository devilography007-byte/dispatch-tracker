import { NextResponse } from "next/server";
import {
  addAuditLog,
  getDatabase,
  makePasswordHash,
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

  const db = getDatabase();
  const user = db
    .prepare(
      "SELECT id, username, password_hash, password_salt, role FROM users WHERE username = ?"
    )
    .get(username) as
    | {
        id: number;
        username: string;
        password_hash: string;
        password_salt: string;
        role: string;
      }
    | undefined;

  if (!user) {
    db.close();
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const expectedHash = makePasswordHash(
    password,
    user.password_salt
  );

  if (expectedHash !== user.password_hash) {
    db.close();
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const token = `dispatch_${randomSessionToken()}`;
  const expiresAt = new Date(
    Date.now() + 12 * 60 * 60 * 1000
  ).toISOString();

  db.prepare(
    `
      INSERT INTO sessions (id, username, expires_at)
      VALUES (?, ?, ?)
    `
  ).run(token, user.username, expiresAt);

  db.close();

  addAuditLog(
    user.username,
    normalizeRole(user.role),
    "login",
    { username: user.username }
  );

  const response = NextResponse.json({
    success: true,
    user: user.username,
    role: normalizeRole(user.role),
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
