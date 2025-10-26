const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;
const store = new Map();

function sanitizeForPalindrome(s) {
  return s.replace(/[^0-9a-z]/gi, "").toLowerCase();
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function analyse(value) {
  const length = value.length;
  const words = value.trim().length === 0 ? [] : value.trim().split(/\s+/);
  const wordCount = words.length;

  const cleaned = sanitizeForPalindrome(value);
  const isPalindrome =
    cleaned.length > 0 && cleaned === cleaned.split("").reverse().join("");

  const characterFrequency = {};
  for (const ch of value) {
    characterFrequency[ch] = (characterFrequency[ch] || 0) + 1;
  }

  const uniqueCharacters = Object.keys(characterFrequency).length;
  const hash = sha256Hex(value);

  return {
    string: value,
    length,
    isPalindrome,
    wordCount,
    uniqueCharacters,
    characterFrequency,
    sha256: hash,
  };
}

/* ---------- ROUTES ---------- */

// POST /api/v1/strings
app.post("/api/v1/strings", (req, res) => {
  const { value } = req.body || {};

  if (value === undefined) return res.status(400).json({ error: "Missing 'value' field" });
  if (typeof value !== "string") return res.status(422).json({ error: "'value' must be a string" });
  if (store.has(value)) return res.status(409).json({ error: "String already exists" });

  const analysis = analyse(value);
  store.set(value, analysis);
  return res.status(201).json(analysis);
});

// GET /api/v1/strings/:value
app.get("/api/v1/strings/:value", (req, res) => {
  const value = req.params.value;
  if (!store.has(value)) return res.status(404).json({ error: "String not found" });
  return res.status(200).json(store.get(value));
});

// GET /api/v1/strings (filters)
app.get("/api/v1/strings", (req, res) => {
  try {
    const { isPalindrome, minLength, maxLength, contains, wordCount } = req.query;
    let results = Array.from(store.values());

    if (isPalindrome !== undefined) {
      if (isPalindrome !== "true" && isPalindrome !== "false")
        return res.status(400).json({ error: "isPalindrome must be 'true' or 'false'" });
      const want = isPalindrome === "true";
      results = results.filter((r) => r.isPalindrome === want);
    }

    if (minLength !== undefined) {
      const n = Number(minLength);
      if (!Number.isFinite(n)) return res.status(400).json({ error: "minLength must be a number" });
      results = results.filter((r) => r.length >= n);
    }

    if (maxLength !== undefined) {
      const n = Number(maxLength);
      if (!Number.isFinite(n)) return res.status(400).json({ error: "maxLength must be a number" });
      results = results.filter((r) => r.length <= n);
    }

    if (wordCount !== undefined) {
      const n = Number(wordCount);
      if (!Number.isFinite(n)) return res.status(400).json({ error: "wordCount must be a number" });
      results = results.filter((r) => r.wordCount === n);
    }

    if (contains !== undefined) {
      results = results.filter((r) => r.string.includes(contains));
    }

    return res.status(200).json({ count: results.length, data: results });
  } catch {
    return res.status(400).json({ error: "Bad query" });
  }
});

// GET /api/v1/strings/filter-by-natural-language
app.get("/api/v1/strings/filter-by-natural-language", (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

  const lower = q.toLowerCase();
  let results = Array.from(store.values());

  if (lower.includes("palind")) {
    results = results.filter((r) => r.isPalindrome);
    return res.status(200).json({ count: results.length, data: results });
  }

  if (lower.includes("single word") || lower.includes("single-word")) {
    results = results.filter((r) => r.wordCount === 1);
    return res.status(200).json({ count: results.length, data: results });
  }

  let m = lower.match(/longer than (\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return res.status(422).json({ error: "Invalid number in query" });
    results = results.filter((r) => r.length > n);
    return res.status(200).json({ count: results.length, data: results });
  }

  m = lower.match(/shorter than (\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return res.status(422).json({ error: "Invalid number in query" });
    results = results.filter((r) => r.length < n);
    return res.status(200).json({ count: results.length, data: results });
  }

  m = lower.match(/contains ["']?([a-z0-9\s\-\_]+)["']?/i);
  if (m) {
    const substr = m[1];
    results = results.filter((r) => r.string.toLowerCase().includes(substr.toLowerCase()));
    return res.status(200).json({ count: results.length, data: results });
  }

  return res.status(400).json({ error: "Could not interpret query" });
});

// DELETE /api/v1/strings/:value
app.delete("/api/v1/strings/:value", (req, res) => {
  const value = req.params.value;
  if (!store.has(value)) return res.status(404).json({ error: "String not found" });
  store.delete(value);
  return res.status(204).send();
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
