// ============================================================
// DEDUPE — duplicate detection helpers for import pipeline
// ============================================================

/**
 * Given freshly parsed rows and a Set of existing order_sn values already
 * in the database (for the target store), split rows into new vs duplicate.
 * Also de-duplicates within the file itself (same SN appearing twice).
 */
function splitNewAndDuplicate(rows, existingOrderSns) {
  const seenInFile = new Set();
  const newRows = [];
  const duplicateRows = [];

  for (const row of rows) {
    const sn = row.order_sn;
    if (existingOrderSns.has(sn) || seenInFile.has(sn)) {
      duplicateRows.push(row);
    } else {
      seenInFile.add(sn);
      newRows.push(row);
    }
  }

  return { newRows, duplicateRows };
}

window.Dedupe = { splitNewAndDuplicate };
