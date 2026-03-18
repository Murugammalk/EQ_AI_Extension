// ============================================================
//  EQ of AI — regexPatterns.js
//  Lightweight pre-filter — runs in browser before ANY API call
//  Returns true = "maybe sensitive" → proceed to Groq
//  Returns false = "definitely clean" → skip API call entirely
//
//  SAME-WORD DEDUP: handled by detectedMap in content.js (per session)
//  RE-DETECTION: cleared every 5 min so edited text can be re-checked
// ============================================================

const EQ_PATTERNS = {
  // Financial
  creditCard  : /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
  upi         : /\b[a-zA-Z0-9._-]{3,}@[a-zA-Z]{3,}\b/,
  gstin       : /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/,
  ifsc        : /\b[A-Z]{4}0[A-Z0-9]{6}\b/,
  pan         : /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
  bankAccount : /\b[0-9]{9,18}\b/,

  // Personal
  email       : /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,
  phoneIN     : /(?:\+91[\s-]?)?[6-9]\d{9}\b/,
  phoneUS     : /\b(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
  aadhaar     : /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/,
  ssn         : /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/,
  dob         : /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/,

  // Government IDs (covers voter ID, passport, driving licence)
  govtId      : /\b[A-Z]{1,3}[0-9]{6,10}\b/,
  drivingIN   : /\b[A-Z]{2}[0-9]{2}[\s-]?[0-9]{4}[0-9]{7}\b/,

  // Network / Technical
  ipv4        : /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/,
  apiKey      : /\b(?:sk-|pk_|rk_|key-|token_|secret_)[A-Za-z0-9_\-]{16,}\b/i,
  jwt         : /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/,
  awsKey      : /\bAKIA[0-9A-Z]{16}\b/,

  // Medical keywords
  medical     : /\b(?:diagnosis|prescription|blood\s?group|HIV|diabetes|cancer|surgery|medication|dosage|mg\s?tablet|patient\s?id|insulin|chemotherapy)\b/i,
};

// Quick check — returns true if ANY pattern matches
function eq_hasAnySensitivePattern(text) {
  if (!text || text.length < 4) return false;
  return Object.values(EQ_PATTERNS).some(re => re.test(text));
}

// Returns matched category hints for backend
function eq_matchedCategories(text) {
  const fin = ["creditCard","upi","gstin","ifsc","pan","bankAccount"];
  const per = ["email","phoneIN","phoneUS","aadhaar","ssn","dob","govtId","drivingIN"];
  const net = ["ipv4","apiKey","jwt","awsKey"];
  const med = ["medical"];
  const matched = new Set();
  for (const [name, re] of Object.entries(EQ_PATTERNS)) {
    if (re.test(text)) {
      if (fin.includes(name)) matched.add("financial");
      if (per.includes(name)) matched.add("personal");
      if (net.includes(name)) matched.add("network");
      if (med.includes(name)) matched.add("medical");
    }
  }
  return [...matched];
}
