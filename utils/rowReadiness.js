const normalizeRowValidation = (entry, fallbackIndex) => ({
  index: Number.isInteger(entry?.index) ? entry.index : fallbackIndex,
  row: Number.isInteger(entry?.row) ? entry.row : fallbackIndex + 2,
  isValid: entry?.isValid === true,
  errors: Array.isArray(entry?.errors) ? entry.errors : [],
});

const prioritizeRowsByValidation = (rows, rowValidation = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const validationByIndex = new Map(
    (Array.isArray(rowValidation) ? rowValidation : []).map((entry) => [
      entry?.index,
      entry,
    ]),
  );

  return safeRows
    .map((row, originalIndex) => {
      const validation = normalizeRowValidation(
        validationByIndex.get(originalIndex),
        originalIndex,
      );

      return {
        row,
        validation,
        originalIndex,
      };
    })
    .sort((first, second) => {
      const firstGroup = first.validation.isValid ? 1 : 0;
      const secondGroup = second.validation.isValid ? 1 : 0;

      if (firstGroup !== secondGroup) {
        return firstGroup - secondGroup;
      }

      return first.originalIndex - second.originalIndex;
    });
};

module.exports = {
  normalizeRowValidation,
  prioritizeRowsByValidation,
};
