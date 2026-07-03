// ==========================================================================
// CSV Loader — fetches and parses questions.csv into question objects
// ==========================================================================

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

// Splits raw CSV text into rows of fields, honoring quoted fields (which may
// contain commas or embedded newlines) per RFC 4180.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // ignore; \n (or end of text) terminates the row
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Flush trailing field/row if the file doesn't end with a newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

function rowToQuestion(fields, rowNumber) {
  const [category, difficulty, clue, answer, option2, option3, option4] = fields.map((f) =>
    (f ?? "").trim()
  );

  if (!VALID_DIFFICULTIES.has(difficulty)) {
    console.warn(`questions.csv row ${rowNumber}: invalid difficulty "${difficulty}" — skipping`);
    return null;
  }

  if (!answer) {
    console.warn(`questions.csv row ${rowNumber}: empty answer — skipping`);
    return null;
  }

  const categories = category
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  if (categories.length === 0) {
    console.warn(`questions.csv row ${rowNumber}: no category specified — skipping`);
    return null;
  }

  let options = [];
  if (difficulty === "hard") {
    options = [answer, option2, option3, option4].map((o) => o.trim()).filter(Boolean);
    if (options.length < 4) {
      console.warn(
        `questions.csv row ${rowNumber}: hard question missing options (found ${options.length}/4)`
      );
    }
  }

  return {
    categories,
    difficulty,
    clue,
    answer: answer.toUpperCase(),
    options,
  };
}

async function loadQuestions() {
  let text;
  try {
    const response = await fetch("questions.csv");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    text = await response.text();
  } catch (err) {
    console.error("Failed to load questions.csv:", err);
    return [];
  }

  const rows = parseCSV(text);
  if (rows.length === 0) return [];

  // First row is the header — skip it.
  const dataRows = rows.slice(1);

  const questions = [];
  dataRows.forEach((fields, index) => {
    const isBlank = fields.every((f) => (f ?? "").trim() === "");
    if (isBlank) return;

    const question = rowToQuestion(fields, index + 2); // +2: header row + 1-index
    if (question) questions.push(question);
  });

  return questions;
}

export { loadQuestions };
