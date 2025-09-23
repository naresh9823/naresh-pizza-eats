// src/routes/order.js
const express = require("express");
const router = express.Router();

let NEXT_ID = 1001;           // in-memory order IDs
const ORDERS = [];            // in-memory store

// POST /api/orders  -> create order
router.post("/orders", (req, res) => {
  const { customer, items, total } = req.body;

  if (!customer || !customer.name || !customer.phone || !customer.address) {
    return res.status(400).json({ ok: false, error: "Missing customer fields" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: "Cart is empty" });
  }

  const order = {
    id: NEXT_ID++,
    customer,
    items,
    total,
    status: "RECEIVED",
    createdAt: new Date().toISOString()
  };

  ORDERS.push(order);
  res.json({ ok: true, orderId: order.id });
});

// GET /api/orders -> view all (for testing)
router.get("/orders", (_req, res) => {
  res.json({ ok: true, data: ORDERS });
});

module.exports = router;