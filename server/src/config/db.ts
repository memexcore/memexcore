import { resolve } from "path";

export const DB_PATH: string =
  process.env.DB_PATH ?? resolve(import.meta.dir, "..", "..", "data", "context-pages.db");
