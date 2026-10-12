export type DmKeywordMatchMode = "EXACT" | "FUZZY" | "CONTAINS";

const FUZZY_DISTANCE_LIMIT = 10;

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

/** Levenshtein distance, capped once it can no longer be below the limit. */
function editDistanceWithinLimit(left: string, right: string, limit: number) {
  const a = Array.from(left);
  const b = Array.from(right);
  if (Math.abs(a.length - b.length) >= limit) return limit;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMinimum = i;
    for (let j = 1; j <= b.length; j += 1) {
      const value = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      current[j] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum >= limit) return limit;
    previous = current;
  }
  return previous[b.length];
}

export function matchDmKeywords(
  message: string,
  keywords: string[],
  mode: DmKeywordMatchMode,
) {
  const normalizedMessage = normalize(message);
  if (!normalizedMessage) return { matched: false, matchedKeyword: null };

  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) continue;
    const matched =
      mode === "EXACT"
        ? normalizedMessage === normalizedKeyword
        : mode === "FUZZY"
          ? editDistanceWithinLimit(normalizedMessage, normalizedKeyword, FUZZY_DISTANCE_LIMIT) < FUZZY_DISTANCE_LIMIT
          : normalizedMessage.includes(normalizedKeyword);
    if (matched) return { matched: true, matchedKeyword: keyword };
  }
  return { matched: false, matchedKeyword: null };
}

/** Conservative conflict check for campaign settings; runtime still decides the winner. */
export function dmKeywordsMayOverlap(
  leftKeywords: string[],
  leftMode: DmKeywordMatchMode,
  rightKeywords: string[],
  rightMode: DmKeywordMatchMode,
) {
  const left = leftKeywords.map(normalize).filter(Boolean);
  const right = rightKeywords.map(normalize).filter(Boolean);
  if (!left.length || !right.length) return false;

  if (leftMode === "CONTAINS" || rightMode === "CONTAINS") {
    if (left.some((a) => right.some((b) => a.includes(b) || b.includes(a)))) return true;
  }
  const limit = FUZZY_DISTANCE_LIMIT;
  return left.some((a) =>
    right.some((b) => {
      if (a === b) return true;
      return (
        (leftMode === "FUZZY" || rightMode === "FUZZY") &&
        editDistanceWithinLimit(a, b, limit) < limit
      );
    }),
  );
}
