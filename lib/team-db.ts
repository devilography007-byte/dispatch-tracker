import crypto from "crypto";
import { createClient, type Client } from "@libsql/client";

export type AppRole = "admin" | "manager" | "user";

export type AppUser = {
  id: number;
  username: string;
  role: AppRole;
};

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables."
      );
    }

    client = createClient({ url, authToken });
  }
  return client;
}

export function normalizeRole(value: string): AppRole {
  if (value === "admin") return "admin";
  if (value === "manager") return "manager";
  return "user";
}

export function makePasswordHash(password: string, salt: string) {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha256")
    .toString("hex");
}

export function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

export function randomSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function ensureSchema(db: Client) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      approved INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      projects TEXT NOT NULL DEFAULT '[]',
      dispatches TEXT NOT NULL DEFAULT '[]'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    INSERT OR IGNORE INTO app_state (id, projects, dispatches)
    VALUES (1, '[]', '[]')
  `);

  // MIGRATION: if "approved" column didn't exist before (older databases),
  // add it, then grandfather in the earliest account as an approved admin
  // so the site owner never gets locked out.
  const info = await db.execute("PRAGMA table_info(users)");
  const hasApproved = info.rows.some(
    (row: any) => row.name === "approved"
  );

  if (!hasApproved) {
    await db.execute(
      "ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 0"
    );
  }

  await db.execute(`
    UPDATE users
    SET approved = 1, role = 'admin'
    WHERE id = (SELECT MIN(id) FROM users)
      AND approved = 0
  `);
}

export async function getDatabase(): Promise<Client> {
  const db = getClient();

  if (!schemaReady) {
    schemaReady = ensureSchema(db);
  }

  await schemaReady;
  return db;
}

export function parseCookieValue(header: string | null, key: string) {
  if (!header) return null;

  for (const chunk of header.split(";")) {
    const [cookieKey, ...rest] = chunk.trim().split("=");
    if (cookieKey === key) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const token = parseCookieValue(cookieHeader, "dispatch_session");

  if (!token) return null;

  const db = await getDatabase();
  const result = await db.execute({
    sql: `
      SELECT sessions.username, users.role, sessions.expires_at
      FROM sessions
      LEFT JOIN users ON users.username = sessions.username
      WHERE sessions.id = ?
    `,
    args: [token],
  });

  const row = result.rows[0] as unknown as
    | { username: string; role: string; expires_at: string }
    | undefined;

  if (!row) return null;

  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await db.execute({
      sql: "DELETE FROM sessions WHERE id = ?",
      args: [token],
    });
    return null;
  }

  return {
    username: row.username,
    role: normalizeRole((row.role as string) || "user"),
  };
}

export async function getUserList() {
  const db = await getDatabase();
  const result = await db.execute(
    "SELECT id, username, role, approved FROM users ORDER BY username ASC"
  );

  return result.rows.map((row: any) => ({
    id: row.id as number,
    username: row.username as string,
    role: normalizeRole(row.role as string),
    approved: Number(row.approved) === 1,
  }));
}

// Public signup. Role and approval are decided internally:
// - The very first account ever created becomes an approved admin.
// - Every account after that is created as an UNAPPROVED "user"
//   and needs an admin to approve it before they can log in.
export async function createUserRecord(username: string, password: string) {
  const cleanUsername = username.trim();
  if (!cleanUsername || !password) {
    throw new Error("Username and password are required.");
  }

  const db = await getDatabase();

  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE username = ?",
    args: [cleanUsername],
  });

  if (existing.rows.length > 0) {
    throw new Error("That username already exists.");
  }

  const countResult = await db.execute("SELECT COUNT(*) as count FROM users");
  const userCount = Number((countResult.rows[0] as any).count);
  const isFirstUser = userCount === 0;

  const role: AppRole = isFirstUser ? "admin" : "user";
  const approved = isFirstUser ? 1 : 0;

  const salt = generateSalt();
  const hash = makePasswordHash(password, salt);

  const result = await db.execute({
    sql: `
      INSERT INTO users (username, password_hash, password_salt, role, approved)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [cleanUsername, hash, salt, role, approved],
  });

  return {
    id: Number(result.lastInsertRowid),
    username: cleanUsername,
    role,
    approved: approved === 1,
  };
}

export async function getPendingUsers() {
  const db = await getDatabase();
  const result = await db.execute(
    "SELECT id, username, role FROM users WHERE approved = 0 ORDER BY id ASC"
  );

  return result.rows.map((row: any) => ({
    id: row.id as number,
    username: row.username as string,
    role: normalizeRole(row.role as string),
  }));
}

export async function approveUserById(userId: number) {
  const db = await getDatabase();
  await db.execute({
    sql: "UPDATE users SET approved = 1 WHERE id = ?",
    args: [userId],
  });
}

export async function rejectUserById(userId: number) {
  const db = await getDatabase();
  await db.execute({
    sql: "DELETE FROM users WHERE id = ? AND approved = 0",
    args: [userId],
  });
}

export async function addAuditLog(
  username: string,
  role: AppRole,
  action: string,
  details: Record<string, unknown> = {}
) {
  const db = await getDatabase();

  await db.execute({
    sql: `
      INSERT INTO audit_logs (username, role, action, details)
      VALUES (?, ?, ?, ?)
    `,
    args: [username, role, action, JSON.stringify(details)],
  });
}

export async function getAuditLogs(username: string, role: AppRole) {
  const db = await getDatabase();

  const sql =
    role === "admin" || role === "manager"
      ? "SELECT username, role, action, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 200"
      : "SELECT username, role, action, details, created_at FROM audit_logs WHERE username = ? ORDER BY id DESC LIMIT 100";

  const result = await db.execute({
    sql,
    args: role === "user" ? [username] : [],
  });

  return result.rows.map((row: any) => ({
    username: row.username as string,
    role: normalizeRole(row.role as string),
    action: row.action as string,
    details: JSON.parse((row.details as string) || "{}"),
    createdAt: row.created_at as string,
  }));
}
