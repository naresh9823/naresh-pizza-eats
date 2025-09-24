// src/server.js
const path = require("path");
const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("better-sqlite3-session-store");
const methodOverride = require("method-override");
const morgan = require("morgan");
const db = require("./db/db");

const SQLiteStore = SQLiteStoreFactory(session);

const app = express();

// ---------- Basic app setup ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views")); // ../views from src/

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(morgan("dev"));
app.use(express.static(path.join(process.cwd(), "public"))); // serves /public

// ---------- Sessions ----------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      // secure: true in production *if* you are behind HTTPS/proxy
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
    store: new SQLiteStore({
      client: db,
      expired: { clear: true, intervalMs: 900_000 }, // clear every 15 min
      // table: "sessions" // uncomment to customize table name
    }),
  })
);

// ---------- Simple auth guard helper ----------
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

// ---------- Routes (mount your routers if present) ----------
try {
  // If you have these route files, they’ll be used automatically.
  const authRouter = require("./routes/auth");
  app.use(authRouter);
} catch (_) {}

try {
  const orderRouter = require("./routes/order");
  app.use("/orders", orderRouter);
} catch (_) {}

try {
  const productRouter = require("./routes/product");
  app.use("/products", productRouter);
} catch (_) {}

// ---------- Basic pages ----------
app.get("/", (req, res) => {
  res.render("index", { user: req.session.user || null });
});

app.get("/login", (req, res) => res.render("login"));
app.get("/signup", (req, res) => res.render("signup"));

app.get("/dashboard", requireAuth, (req, res) => {
  res.render("dashboard", { user: req.session.user });
});

// Health check (useful for Render)
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`DB file: ${process.env.DB_FILE || path.join(process.cwd(), "app.db")}`);
});