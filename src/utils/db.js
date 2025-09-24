// src/db/db.js
const path = require("path");
const Database = require("better-sqlite3");

// In production (Render/Railway) we point to a persistent disk (e.g. /data/app.db).
// Locally it falls back to a file in your project root.
const dbFile = process.env.DB_FILE || path.join(process.cwd(), "app.db");

// Open the database. Better-sqlite3 opens the file if it exists or creates it.
const db = new Database(dbFile, { verbose: null });

// Quick safety: enforce foreign keys
db.pragma("foreign_keys = ON");

module.exports = db;