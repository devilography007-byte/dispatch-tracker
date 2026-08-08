import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_PATH = path.join(
  process.cwd(),
  "data",
  "dispatch-tracker.db"
);

function getDatabase() {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);

  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      projects TEXT NOT NULL DEFAULT '[]',
      dispatches TEXT NOT NULL DEFAULT '[]'
    );

    INSERT OR IGNORE INTO app_state (id, projects, dispatches)
    VALUES (1, '[]', '[]');
  `);

  return db;
}

export async function GET() {
  const db = getDatabase();

  const row = db
    .prepare(
      "SELECT projects, dispatches FROM app_state WHERE id = 1"
    )
    .get() as
    | { projects: string; dispatches: string }
    | undefined;

  db.close();

  return Response.json({
    projects: row ? JSON.parse(row.projects) : [],
    dispatches: row ? JSON.parse(row.dispatches) : [],
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const payload = {
    projects: Array.isArray(body?.projects) ? body.projects : [],
    dispatches: Array.isArray(body?.dispatches) ? body.dispatches : [],
  };

  const db = getDatabase();

  db.prepare(
    "UPDATE app_state SET projects = ?, dispatches = ? WHERE id = 1"
  ).run(
    JSON.stringify(payload.projects),
    JSON.stringify(payload.dispatches)
  );

  db.close();

  return Response.json({ success: true, ...payload });
}
