const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto-js");

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

// In-memory “database”
const stringStore = new Map();

/* ---------- helpers ---------- */
function analyseString(str) {
  const length = str.length;
  const words = str.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const reversed = str.split("").reverse().join("");
  const palindrome = str === reversed;
  const uniqueChars = new Set(str).size;
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const hash = crypto.SHA256(str).toString();
  return { value: str, length, wordCount, palindrome, uniqueChars, freq, hash };
}

app.get('/', (req, res) => {
  res.status(200).json({message: "Say Hello to my string Analyser!"});
});


/* ---------- POST /strings ---------- */
app.post("/strings", (req, res) => {
  const { value } = req.body;

  if (value === undefined) return res.status(400).json({ error: "Missing 'value' field" });
  if (typeof value !== "string") return res.status(422).json({ error: "'value' must be a string" });
  if (stringStore.has(value)) return res.status(409).json({ error: "String already exists" });

  const analysis = analyseString(value);
  stringStore.set(value, analysis);
  res.status(201).json(analysis);
});

/* ---------- GET /strings/:value ---------- */
app.get("/strings/:value", (req, res) => {
  const value = req.params.value;
  if (!stringStore.has(value)) return res.status(404).json({ error: "Not found" });
  res.json(stringStore.get(value));
});

/* ---------- GET /strings (filters) ---------- */
app.get("/strings", (req, res) => {
  try {
    const { palindrome, minLength, maxLength, contains } = req.query;
    let results = Array.from(stringStore.values());

    if (palindrome !== undefined)
      results = results.filter(r => r.palindrome === (palindrome === "true"));
    if (minLength) results = results.filter(r => r.length >= Number(minLength));
    if (maxLength) results = results.filter(r => r.length <= Number(maxLength));
    if (contains) results = results.filter(r => r.value.includes(contains));

    res.json(results);
  } catch {
    res.status(400).json({ error: "Invalid query parameters" });
  }
});

/* ---------- GET /query (natural language) ---------- */
app.get("/query", (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query" });

  const lower = q.toLowerCase();
  let results = Array.from(stringStore.values());

  try {
    if (lower.includes("palindrome")) {
      results = results.filter(r => r.palindrome);
    } else if (lower.includes("longer than")) {
      const n = parseInt(lower.match(/longer than (\d+)/)?.[1]);
      if (isNaN(n)) return res.status(422).json({ error: "Invalid number in query" });
      results = results.filter(r => r.length > n);
    } else if (lower.includes("shorter than")) {
      const n = parseInt(lower.match(/shorter than (\d+)/)?.[1]);
      if (isNaN(n)) return res.status(422).json({ error: "Invalid number in query" });
      results = results.filter(r => r.length < n);
    } else if (lower.includes("single word")) {
      results = results.filter(r => r.wordCount === 1);
    } else {
      return res.status(400).json({ error: "Could not interpret query" });
    }

    res.json(results);
  } catch {
    res.status(422).json({ error: "Error processing query" });
  }
});

/* ---------- DELETE /strings/:value ---------- */
app.delete("/strings/:value", (req, res) => {
  const { value } = req.params;
  if (!stringStore.has(value)) return res.status(404).json({ error: "Not found" });
  stringStore.delete(value);
  res.status(204).send();
});

/* ---------- run ---------- */
app.listen(PORT, () => console.log(`String Analyser running on port http://localhost:${PORT}`));
