# Backend_Stage_1_task-HNGi13
Second task on HNG-2025-Stage-One

This API analyzes any string sent to it and provides useful details such as:

The string length

Whether it’s a palindrome

Number of words

Number of unique characters

Frequency of each character

SHA-256 hash of the string

It was built as part of HNGi13 Backend Stage 1 using Node.js (Express).

https://<your-railway-app>.railway.app/

## API Endpoints

## 1 POST /strings

Analyze and store a new string.

Request Body:
{
  "string": "SADIQ"
}

Success Response (201):
{
  "status": "success",
  "data": {
    "string": "madam",
    "length": 5,
    "wordCount": 1,
    "uniqueCharacters": 3,
    "characterFrequency": { "m": 2, "a": 2, "d": 1 },
    "isPalindrome": true,
    "sha256": "6d00a2a7b4b4e3a97f..."
  }
}

Error Responses:
Code	Message
400	Missing string value
409	String already exists
422	Invalid string input


## 2 GET /strings/:string

Fetch analysis details for a specific string.

GET /strings/SADIQ

Response (200):
{
  "string": "madam",
  "length": 5,
  "isPalindrome": true,
  "wordCount": 1,
  "uniqueCharacters": 3,
  "characterFrequency": { "m": 2, "a": 2, "d": 1 },
  "sha256": "6d00a2a7b4b4e3a97f..."
}

Error:
Code	Message
404	String not found

## 3 GET /strings?filter=...

Get all strings matching certain filters (e.g., palindromes, length, etc).

GET /strings?length_gte=5&palindrome=true

Response: 
{
  "count": 2,
  "data": [ ... ]
}

## 4 GET /strings/query?q=...

Allows natural language queries.

GET /strings/query?q=all single word palindromic strings

Response:

{
  "count": 1,
  "data": [
    {
      "string": "madam",
      "isPalindrome": true,
      "wordCount": 1
    }
  ]
}

## 5 DELETE /strings/:string

Deletes a string’s record.
