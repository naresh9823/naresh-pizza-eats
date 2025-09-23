const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

// Run schema
db.exec(schemaSql);

// Helpers
const insertProduct = db.prepare(
  'INSERT INTO products (name, description, price_cents, image) VALUES (?, ?, ?, ?)'
);
const insertUser = db.prepare(
  'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)'
);

// Seed products (images are filenames under /public/images)
const products = [
  ['Margherita', 'Classic tomato, mozzarella, basil', 899, 'margherita.jpg'],
  ['Pepperoni', 'Loaded with pepperoni slices', 1099, 'pepperoni.jpg'],
  ['Veggie Delight', 'Bell peppers, onions, olives, mushrooms', 999, 'veggie.jpg'],
  ['BBQ Chicken', 'BBQ sauce, chicken, onion, cilantro', 1199, 'bbq-chicken.jpg'],
  ['Hawaiian', 'Ham and pineapple (controversial but tasty!)', 1099, 'hawaiian.jpg']
];

const seed = db.transaction(() => {
  db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM products; DELETE FROM users;');

  products.forEach(p => insertProduct.run(p[0], p[1], p[2], p[3]));

  const adminHash = bcrypt.hashSync('admin123', 10);
  insertUser.run('Admin', 'admin@npeats.local', adminHash, 1);

  const userHash = bcrypt.hashSync('user123', 10);
  insertUser.run('Test User', 'user@npeats.local', userHash, 0);
});

seed();

console.log('✅ Database reset complete.');
console.log('   Admin  -> email: admin@npeats.local, password: admin123');
console.log('   User   -> email: user@npeats.local,  password: user123');
console.log('   Products seeded. Place images under public/images with the same filenames.');