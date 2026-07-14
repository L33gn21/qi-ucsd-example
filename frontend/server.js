const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 5173;
const BACKEND_URL = process.env.BACKEND_URL || "";

const app = express();

app.get("/config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(`window.API_BASE = ${JSON.stringify(BACKEND_URL)};`);
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`VoxShield frontend listening on http://localhost:${PORT}`);
});
