// src/server.js
const path = require("path");
const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("better-sqlite3-session-store");
const methodOverride = require("method-override");
const morgan = require("morgan");
const db = require("./db/db.js");

const SQLiteStore = SQLiteStoreFactory(session);
const app = express();

// ---------- Basic app setup ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(morgan("dev"));
app.use(express.static(path.join(process.cwd(), "public")));

// ---------- Add locals (user + flash always defined) ----------
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = null;
  next();
});

// ---------- Sessions ----------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
    store: new SQLiteStore({
      client: db,
      expired: { clear: true, intervalMs: 900_000 },
    }),
  })
);

// ---------- Auth guard ----------
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

// ---------- Routes ----------
try {
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

// ---------- Homepage ----------
app.get("/", (req, res) => {
  const products = [
    { name: "Margherita", image: "margherita.jpg" },
    { name: "Pepperoni", image: "pepperoni.jpg" },
    { name: "Veggie", image: "veggie.jpg" },
    { name: "BBQ Chicken", image: "bbq-chicken.jpg" },
    { name: "Hawaiian", image: "hawaiian.jpg" },
  ];
  res.render("index", { title: "Home", products });
});

// ---------- Other pages ----------
app.get("/login", (req, res) => {
  res.render("login", { title: "Login" });
});

app.get("/signup", (req, res) => {
  res.render("signup", { title: "Sign up" });
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.render("dashboard", { title: "Dashboard" });
});

// Health check
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(
    `DB file: ${process.env.DB_FILE || path.join(process.cwd(), "app.db")}`
  );
});
