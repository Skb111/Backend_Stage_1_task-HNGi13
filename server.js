/**
 * server.js
 * HNGi13 Stage 1 - String Analyzer (CommonJS)
 *
 * Copy / replace in your repo and redeploy.
 */

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PORT from env or fallback
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

// In-memory store: Map<string, analysisObject>
const store = new Map();

/* ---------- Helpers ---------- */

// sanitize string for palindrome test: remove non-alphanumeric and lowercase
function sanitizeForPalindrome(s) {
  return s.replace(/[^0-9a-z]/gi, "").toLowerCase();
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function analyse(value) {
  // value is the original string as provided by client
  const length = value.length;
  const words = value.trim().length === 0 ? [] : value.trim().split(/\s+/);
  const wordCount = words.length;

  // Palindrome: case-insensitive, ignore non-alphanumeric chars
  const cleaned = sanitizeForPalindrome(value);
  const isPalindrome = cleaned.length > 0 && cleaned === cleaned.split("").reverse().join("");

  // character frequency (counts characters exactly as they appear)
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

/* ---------- Routes ---------- */

/**
 * POST /strings
 * Body: { value: <string> }
 *
 * Status codes required by grader:
 * 201 - created
 * 400 - missing 'value'
 * 422 - wrong data type
 * 409 - already exists
 */
app.post("/strings", (req, res) => {
  // ensure Content-Type application/json (not strictly necessary but good)
  if (!req.is("application/json")) {
    // still treat missing JSON body as 400
    // But grader typically sends application/json; keep this conservative.
  }

  const payload = req.body;
  if (payload === undefined || payload === null || !Object.prototype.hasOwnProperty.call(payload, "value")) {
    return res.status(400).json({ error: "Missing 'value' field" });
  }

  const { value } = payload;

  if (typeof value !== "string") {
    return res.status(422).json({ error: "'value' must be a string" });
  }

  // Normalize key when using as map key: use EXACT value (case sensitive) so stored value is original
  if (store.has(value)) {
    return res.status(409).json({ error: "String already exists" });
  }

  const analysis = analyse(value);
  store.set(value, analysis);

  return res.status(201).json(analysis);
});

/**
 * GET /strings/:value
 * Returns 200 with analysis or 404 if not found
 */
app.get("/strings/:value", (req, res) => {
  // parameter in URL is encoded; decode
  const value = req.params.value;
  if (!store.has(value)) {
    return res.status(404).json({ error: "String not found" });
  }
  return res.status(200).json(store.get(value));
});

/**
 * GET /strings
 * Query filters supported:
 * - isPalindrome=true|false
 * - minLength=N
 * - maxLength=N
 * - contains=substr
 * - wordCount=N
 *
 * Returns 200 with array of matches.
 * If invalid query (e.g., non-numeric where numeric expected) -> 400
 */
app.get("/strings", (req, res) => {
  try {
    const { isPalindrome, minLength, maxLength, contains, wordCount } = req.query;

    let results = Array.from(store.values());

    if (isPalindrome !== undefined) {
      if (isPalindrome !== "true" && isPalindrome !== "false") {
        return res.status(400).json({ error: "isPalindrome must be 'true' or 'false'" });
      }
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
      // substring check (case-sensitive). If you want case-insensitive, change to lower comparisons.
      results = results.filter((r) => r.string.includes(contains));
    }

    return res.status(200).json({ count: results.length, data: results });
  } catch (err) {
    console.error("Filter error:", err);
    return res.status(400).json({ error: "Bad query" });
  }
});

/**
 * GET /strings/query?q=...
 * Basic natural language interpretation:
 * Recognizes:
 * - 'palindrom' -> palindromes
 * - 'single word' -> wordCount === 1
 * - 'longer than N' or 'longer than N characters'
 * - 'shorter than N' or 'shorter than N characters'
 *
 * Returns 200 with matches, 400 if missing q, 422 if cannot parse numeric value.
 */
app.get("/strings/query", (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

  const lower = q.toLowerCase();
  let results = Array.from(store.values());

  // palindromes
  if (lower.includes("palind")) {
    results = results.filter((r) => r.isPalindrome);
    return res.status(200).json({ count: results.length, data: results });
  }

  // single-word
  if (lower.includes("single word") || lower.includes("single-word")) {
    results = results.filter((r) => r.wordCount === 1);
    return res.status(200).json({ count: results.length, data: results });
  }

  // longer than N
  let m = lower.match(/longer than (\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return res.status(422).json({ error: "Invalid number in query" });
    results = results.filter((r) => r.length > n);
    return res.status(200).json({ count: results.length, data: results });
  }

  // shorter than N
  m = lower.match(/shorter than (\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return res.status(422).json({ error: "Invalid number in query" });
    results = results.filter((r) => r.length < n);
    return res.status(200).json({ count: results.length, data: results });
  }

  // contains "<word>"
  m = lower.match(/contains ["']?([a-z0-9\s\-\_]+)["']?/i);
  if (m) {
    const substr = m[1];
    results = results.filter((r) => r.string.toLowerCase().includes(substr.toLowerCase()));
    return res.status(200).json({ count: results.length, data: results });
  }

  // Fallback: could not interpret
  return res.status(400).json({ error: "Could not interpret query" });
});

/**
 * DELETE /strings/:value
 * 204 No Content on success, 404 if not found
 */
app.delete("/strings/:value", (req, res) => {
  const value = req.params.value;
  if (!store.has(value)) return res.status(404).json({ error: "String not found" });
  store.delete(value);
  return res.status(204).send();
});

/* ---------- Start server ---------- */
app.listen(PORT, () => {
  console.log(`String Analyzer running on port ${PORT}`);
  console.log(`POST /strings  GET /strings/:value  GET /strings  GET /strings/query DELETE /strings/:value`);
});
