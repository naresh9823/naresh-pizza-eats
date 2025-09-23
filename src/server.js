const path = require('path');
const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const methodOverride = require('method-override');
const bcrypt = require('bcryptjs');

const db = require('./utils/db');
const { ensureLoggedIn, ensureAdmin } = require('./middleware/auth');

// --- Session store (better-sqlite3) ---
const SQLiteStore = require('better-sqlite3-session-store')(session);
const app = express();

// Paths
const VIEWS_DIR = path.join(__dirname, '..', 'views');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// View engine
app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);

// Middleware
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(PUBLIC_DIR));

app.use(
  session({
    store: new SQLiteStore({
      client: db, // re-use same DB
      expired: { clear: true, intervalMs: 15 * 60 * 1000 }
    }),
    secret: 'super-secret-naresh-pizza', // change later if you want
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
  })
);

// Make user & cart available to views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  const cart = req.session.cart || { items: {}, totalCents: 0, totalQty: 0 };
  res.locals.cartQty = cart.totalQty || 0;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// --- DB helpers ---
const q = {
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  createUser: db.prepare('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)'),
  allProducts: db.prepare('SELECT * FROM products ORDER BY id'),
  getProduct: db.prepare('SELECT * FROM products WHERE id = ?'),
  insertOrder: db.prepare(
    'INSERT INTO orders (user_id, total_cents, name, phone, address, status) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  insertOrderItem: db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)'
  ),
  getOrderForUser: db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?'),
  getOrderItems: db.prepare(`
    SELECT oi.*, p.name as product_name 
    FROM order_items oi 
    JOIN products p ON p.id = oi.product_id 
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `),
  // Admin
  allOrders: db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `),
  updateOrderStatus: db.prepare('UPDATE orders SET status = ? WHERE id = ?'),
  getOrderById: db.prepare('SELECT * FROM orders WHERE id = ?')
};

// --- Utility: Cart in session ---
function getCart(req) {
  if (!req.session.cart) {
    req.session.cart = { items: {}, totalCents: 0, totalQty: 0 };
  }
  return req.session.cart;
}
function recalcCart(cart) {
  let totalCents = 0;
  let totalQty = 0;
  for (const id of Object.keys(cart.items)) {
    const it = cart.items[id];
    totalCents += it.price_cents * it.qty;
    totalQty += it.qty;
  }
  cart.totalCents = totalCents;
  cart.totalQty = totalQty;
}

// --- Routes ---
// Home / Menu
app.get('/', (req, res) => {
  const products = q.allProducts.all();
  res.render('index', { products, title: 'Naresh Pizza Eats' });
});

// Contact (Google Map iframe, no API key needed)
app.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact' });
});

// Auth
app.get('/signup', (req, res) => res.render('signup', { title: 'Create Account' }));
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    req.session.flash = { type: 'error', msg: 'All fields are required.' };
    return res.redirect('/signup');
  }
  const exists = q.getUserByEmail.get(email);
  if (exists) {
    req.session.flash = { type: 'error', msg: 'Email already registered.' };
    return res.redirect('/signup');
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = q.createUser.run(name, email, hash, 0);
  req.session.user = { id: info.lastInsertRowid, name, email, is_admin: 0 };
  res.redirect('/');
});

app.get('/login', (req, res) => res.render('login', { title: 'Login' }));
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = q.getUserByEmail.get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    req.session.flash = { type: 'error', msg: 'Invalid credentials.' };
    return res.redirect('/login');
  }
  req.session.user = { id: user.id, name: user.name, email: user.email, is_admin: !!user.is_admin };
  const nextUrl = req.query.next && req.query.next.startsWith('/') ? req.query.next : null;
  if (user.is_admin) return res.redirect('/admin');
  return res.redirect(nextUrl || '/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Cart
app.post('/cart/add', (req, res) => {
  const { product_id, qty } = req.body;
  const product = q.getProduct.get(product_id);
  if (!product) {
    req.session.flash = { type: 'error', msg: 'Product not found.' };
    return res.redirect('/');
  }
  const cart = getCart(req);
  const id = String(product.id);
  const addQty = Math.max(1, parseInt(qty || '1', 10));
  if (!cart.items[id]) {
    cart.items[id] = {
      id: product.id,
      name: product.name,
      price_cents: product.price_cents,
      image: product.image,
      qty: 0
    };
  }
  cart.items[id].qty += addQty;
  recalcCart(cart);
  req.session.flash = { type: 'success', msg: `Added ${addQty} × ${product.name} to cart.` };
  res.redirect('/');
});

app.post('/cart/remove', (req, res) => {
  const { product_id } = req.body;
  const cart = getCart(req);
  delete cart.items[String(product_id)];
  recalcCart(cart);
  res.redirect('/cart');
});

app.get('/cart', (req, res) => {
  const cart = getCart(req);
  res.render('cart', { cart, title: 'Your Cart' });
});

// Checkout
app.get('/checkout', ensureLoggedIn, (req, res) => {
  const cart = getCart(req);
  if (!cart.totalQty) {
    req.session.flash = { type: 'error', msg: 'Your cart is empty.' };
    return res.redirect('/');
  }
  res.render('checkout', { cart, title: 'Checkout' });
});

app.post('/checkout', ensureLoggedIn, (req, res) => {
  const cart = getCart(req);
  if (!cart.totalQty) {
    req.session.flash = { type: 'error', msg: 'Your cart is empty.' };
    return res.redirect('/');
  }
  const { name, phone, address } = req.body;
  if (!name || !phone || !address) {
    req.session.flash = { type: 'error', msg: 'Please fill all fields.' };
    return res.redirect('/checkout');
  }

  const insert = db.transaction(() => {
    const orderInfo = q.insertOrder.run(req.session.user.id, cart.totalCents, name, phone, address, 'Pending');
    const orderId = orderInfo.lastInsertRowid;
    for (const id of Object.keys(cart.items)) {
      const it = cart.items[id];
      q.insertOrderItem.run(orderId, it.id, it.qty, it.price_cents);
    }
    return orderId;
  });

  const orderId = insert();
  // Clear cart
  req.session.cart = { items: {}, totalCents: 0, totalQty: 0 };
  res.redirect(`/order/confirmation/${orderId}`);
});

// Confirmation (user must own order)
app.get('/order/confirmation/:id', ensureLoggedIn, (req, res) => {
  const orderId = Number(req.params.id);
  const order = q.getOrderForUser.get(orderId, req.session.user.id);
  if (!order) return res.status(404).send('Order not found.');
  const items = q.getOrderItems.all(orderId);
  res.render('confirmation', { order, items, title: 'Order Confirmation' });
});

// --- Admin ---
app.get('/admin/login', (req, res) => res.render('admin/login', { title: 'Admin Login' }));
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const user = q.getUserByEmail.get(email);
  if (!user || !user.is_admin || !bcrypt.compareSync(password, user.password_hash)) {
    req.session.flash = { type: 'error', msg: 'Invalid admin credentials.' };
    return res.redirect('/admin/login');
  }
  req.session.user = { id: user.id, name: user.name, email: user.email, is_admin: true };
  res.redirect('/admin');
});

app.get('/admin', ensureAdmin, (req, res) => {
  const orders = q.allOrders.all();
  const orderItemsByOrder = {};
  orders.forEach(o => {
    orderItemsByOrder[o.id] = q.getOrderItems.all(o.id);
  });
  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    orders,
    orderItemsByOrder,
    statuses: ['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Cancelled']
  });
});

app.post('/admin/orders/:id/status', ensureAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const allowed = new Set(['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Cancelled']);
  if (!allowed.has(status)) {
    req.session.flash = { type: 'error', msg: 'Invalid status.' };
    return res.redirect('/admin');
  }
  const exists = q.getOrderById.get(id);
  if (!exists) {
    req.session.flash = { type: 'error', msg: 'Order not found.' };
    return res.redirect('/admin');
  }
  q.updateOrderStatus.run(status, id);
  res.redirect('/admin');
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🍕 Naresh Pizza Eats running at http://localhost:${PORT}`);
});