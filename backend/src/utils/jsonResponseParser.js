function stripMarkdownFences(value = '') {
  return String(value)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function removeInvalidControlCharacters(value = '') {
  return String(value)
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function extractBalancedJsonObject(value = '') {
  const text = String(value);
  const start = text.indexOf('{');

  if (start < 0) {
    return '';
  }

  let depth = 0;
  let insideString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (insideString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        insideString = false;
      }

      continue;
    }

    if (character === '"') {
      insideString = true;
      continue;
    }

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return '';
}

function repairCommonJsonProblems(value = '') {
  return String(value)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export function parseModelJson(rawText, errorMessage = 'AI returned invalid JSON.') {
  const cleaned = removeInvalidControlCharacters(
    stripMarkdownFences(rawText),
  );

  const attempts = [
    cleaned,
    extractBalancedJsonObject(cleaned),
  ].filter(Boolean);

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      try {
        return JSON.parse(repairCommonJsonProblems(attempt));
      } catch {
        // Try the next candidate.
      }
    }
  }

  throw new Error(errorMessage);
}
