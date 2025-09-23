const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Store the DB at project-root/db/app.db
const dbPath = path.join(__dirname, '..', '..', 'db', 'app.db');

// Make sure the directory exists (create if missing)
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Helpful debug (you'll see this once on start)
console.log('🗄️  SQLite DB path ->', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;