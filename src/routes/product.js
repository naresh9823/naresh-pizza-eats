// src/routes/product.js
const express = require("express");
const pizzas = require("../data/pizzas");

const router = express.Router();

// GET /api/pizzas -> list pizzas
router.get("/pizzas", (_req, res) => {
  res.json({ ok: true, data: pizzas });
});

module.exports = router;