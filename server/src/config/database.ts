import { Database } from "bun:sqlite";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { DB_PATH } from "./db";

mkdirSync(resolve(DB_PATH, ".."), { recursive: true });

export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
