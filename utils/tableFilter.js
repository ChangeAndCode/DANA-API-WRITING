const normalizeTableFilterText = (value) => {
  if (Array.isArray(value)) {
    return value
      .map(normalizeTableFilterText)
      .join(" ");
  }

  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const normalizeSelectedColumnKeys = (
  selectedColumnKeys,
) =>
  new Set(
    Array.from(selectedColumnKeys || []).map(
      (key) => String(key),
    ),
  );

const matchesTableFilter = ({
  item,
  columns,
  selectedColumnKeys,
  query,
  getValue,
}) => {
  const normalizedQuery =
    normalizeTableFilterText(query);

  if (!normalizedQuery) {
    return true;
  }

  const selectedKeys =
    normalizeSelectedColumnKeys(
      selectedColumnKeys,
    );

  if (selectedKeys.size === 0) {
    return false;
  }

  return columns.some((column) => {
    if (!selectedKeys.has(column.key)) {
      return false;
    }

    const value =
      typeof column.getValue === "function"
        ? column.getValue(item)
        : getValue(item, column.key, column);

    return normalizeTableFilterText(
      value,
    ).includes(normalizedQuery);
  });
};

const filterTableItems = ({
  items,
  columns,
  selectedColumnKeys,
  query,
  getValue,
}) => {
  const sourceItems = Array.from(items || []);

  return sourceItems.filter((item) =>
    matchesTableFilter({
      item,
      columns,
      selectedColumnKeys,
      query,
      getValue,
    }),
  );
};

module.exports = {
  filterTableItems,
  matchesTableFilter,
  normalizeTableFilterText,
};
