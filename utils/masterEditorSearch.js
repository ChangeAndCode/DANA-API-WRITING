const ACCENT_INSENSITIVE_CLASSES = {
  a: "[a\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5]",
  e: "[e\u00e8\u00e9\u00ea\u00eb]",
  i: "[i\u00ec\u00ed\u00ee\u00ef]",
  n: "[n\u00f1]",
  o: "[o\u00f2\u00f3\u00f4\u00f5\u00f6]",
  u: "[u\u00f9\u00fa\u00fb\u00fc]",
};

const escapeRegularExpressionCharacter = (
  character,
) =>
  /[.*+?^$\{\}()|[\]\\]/.test(
    character,
  )
    ? `\\${character}`
    : character;

const buildAccentInsensitiveLiteralPattern = (
  value,
) => {
  const normalizedValue = String(
    value ?? "",
  )
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return Array.from(normalizedValue)
    .map(
      (character) =>
        ACCENT_INSENSITIVE_CLASSES[
          character
        ] ||
        escapeRegularExpressionCharacter(
          character,
        ),
    )
    .join("");
};

const parseMasterEditorColumnIndexes = (
  value,
) => {
  const values = Array.isArray(value)
    ? value
    : [value];

  return Array.from(
    new Set(
      values
        .flatMap((entry) =>
          String(entry ?? "").split(","),
        )
        .map((entry) =>
          Number.parseInt(
            String(entry).trim(),
            10,
          ),
        )
        .filter(
          (columnIndex) =>
            Number.isInteger(columnIndex) &&
            columnIndex > 0,
        ),
    ),
  );
};

const buildMasterEditorSearchExpression = ({
  search,
  columnIndexes,
}) => {
  const pattern =
    buildAccentInsensitiveLiteralPattern(
      search,
    );
  const safeColumnIndexes =
    parseMasterEditorColumnIndexes(
      columnIndexes,
    );

  if (
    !pattern ||
    safeColumnIndexes.length === 0
  ) {
    return null;
  }

  return {
    $expr: {
      $gt: [
        {
          $size: {
            $filter: {
              input: {
                $ifNull: [
                  "$rawCells",
                  [],
                ],
              },
              as: "cell",
              cond: {
                $and: [
                  {
                    $in: [
                      "$$cell.columnIndex",
                      safeColumnIndexes,
                    ],
                  },
                  {
                    $regexMatch: {
                      input: {
                        $convert: {
                          input:
                            "$$cell.value",
                          to: "string",
                          onError: "",
                          onNull: "",
                        },
                      },
                      regex: pattern,
                      options: "i",
                    },
                  },
                ],
              },
            },
          },
        },
        0,
      ],
    },
  };
};

module.exports = {
  buildAccentInsensitiveLiteralPattern,
  buildMasterEditorSearchExpression,
  parseMasterEditorColumnIndexes,
};
