import tableFilterUtils from "../../utils/tableFilter.js";

const {
  filterTableItems,
} = tableFilterUtils;

const DEFAULT_TEXTS = {
  columnsLabel: "Buscar en",
  allColumns: "Todas las columnas",
  noColumns: "Selecciona columnas",
  searchLabel: "Texto a buscar",
  searchPlaceholder: "Escribe para filtrar...",
  clearButton: "Limpiar filtro",
  results: (matching, total) =>
    `${matching} de ${total} filas`,
};

const createElement = (
  tagName,
  className,
  textContent,
) => {
  const element =
    document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
};

const normalizeColumns = (columns) => {
  const seenKeys = new Set();

  return Array.from(columns || []).map(
    (column, index) => {
      const normalizedColumn =
        typeof column === "string"
          ? {
              key: column,
              label: column,
            }
          : {
              ...column,
              key: String(
                column?.key ?? index,
              ),
              label: String(
                column?.label ??
                  column?.key ??
                  index,
              ),
            };

      if (
        !normalizedColumn.key ||
        seenKeys.has(normalizedColumn.key)
      ) {
        throw new Error(
          "Cada columna del filtro debe tener una clave unica.",
        );
      }

      seenKeys.add(normalizedColumn.key);

      return normalizedColumn;
    },
  );
};

export const createTableFilter = ({
  container,
  columns = [],
  getItems = () => [],
  getValue = (item, key) =>
    item?.[key],
  setItemVisibility,
  beforeApply = () => {},
  onChange = () => {},
  texts = {},
} = {}) => {
  if (
    !container ||
    typeof container.appendChild !==
      "function"
  ) {
    throw new Error(
      "El filtro necesita un contenedor valido.",
    );
  }

  const labels = {
    ...DEFAULT_TEXTS,
    ...texts,
  };

  let activeColumns = [];
  let selectedColumnKeys = new Set();
  let isDestroyed = false;
  let isDisabled = false;

  const root = createElement(
    "section",
    "table-filter",
  );
  root.setAttribute(
    "aria-label",
    "Filtro de tabla",
  );

  const columnsField = createElement(
    "div",
    "table-filter__field table-filter__columns",
  );
  const columnsLabel = createElement(
    "span",
    "table-filter__label",
    labels.columnsLabel,
  );
  const columnsButton = createElement(
    "button",
    "table-filter__columns-button",
  );
  columnsButton.type = "button";
  columnsButton.setAttribute(
    "aria-haspopup",
    "listbox",
  );
  columnsButton.setAttribute(
    "aria-expanded",
    "false",
  );

  const columnsButtonText = createElement(
    "span",
    "table-filter__columns-text",
  );
  const columnsButtonCaret = createElement(
    "span",
    "table-filter__caret",
    "\u25be",
  );
  columnsButtonCaret.setAttribute(
    "aria-hidden",
    "true",
  );
  columnsButton.append(
    columnsButtonText,
    columnsButtonCaret,
  );

  const columnsMenu = createElement(
    "div",
    "table-filter__columns-menu",
  );
  columnsMenu.hidden = true;
  columnsMenu.setAttribute(
    "role",
    "listbox",
  );
  columnsMenu.setAttribute(
    "aria-multiselectable",
    "true",
  );

  columnsField.append(
    columnsLabel,
    columnsButton,
    columnsMenu,
  );

  const searchField = createElement(
    "label",
    "table-filter__field table-filter__search-field",
  );
  const searchLabel = createElement(
    "span",
    "table-filter__label",
    labels.searchLabel,
  );
  const searchInput = createElement(
    "input",
    "table-filter__search-input",
  );
  searchInput.type = "search";
  searchInput.placeholder =
    labels.searchPlaceholder;
  searchInput.autocomplete = "off";
  searchField.append(
    searchLabel,
    searchInput,
  );

  const clearField = createElement(
    "div",
    "table-filter__clear-field",
  );
  const clearButton = createElement(
    "button",
    "table-filter__clear-button",
    labels.clearButton,
  );
  clearButton.type = "button";
  clearField.appendChild(clearButton);

  const resultStatus = createElement(
    "span",
    "table-filter__results",
  );
  resultStatus.setAttribute(
    "role",
    "status",
  );
  resultStatus.setAttribute(
    "aria-live",
    "polite",
  );

  root.append(
    columnsField,
    searchField,
    clearField,
    resultStatus,
  );
  container.appendChild(root);

  const closeColumnsMenu = () => {
    columnsMenu.hidden = true;
    columnsButton.setAttribute(
      "aria-expanded",
      "false",
    );
  };

  const syncColumnControls = () => {
    const allCheckbox =
      columnsMenu.querySelector(
        "[data-table-filter-all]",
      );
    const allSelected =
      activeColumns.length > 0 &&
      selectedColumnKeys.size ===
        activeColumns.length;

    if (allCheckbox) {
      allCheckbox.checked = allSelected;
      allCheckbox.disabled = isDisabled;
      allCheckbox.indeterminate =
        selectedColumnKeys.size > 0 &&
        !allSelected;
    }

    columnsMenu
      .querySelectorAll(
        "[data-table-filter-column]",
      )
      .forEach((checkbox) => {
        checkbox.checked =
          selectedColumnKeys.has(
            checkbox.dataset
              .tableFilterColumn,
          );
        checkbox.disabled = isDisabled;
      });

    if (allSelected) {
      columnsButtonText.textContent =
        labels.allColumns;
    } else if (
      selectedColumnKeys.size === 0
    ) {
      columnsButtonText.textContent =
        labels.noColumns;
    } else if (
      selectedColumnKeys.size === 1
    ) {
      const selectedKey =
        Array.from(selectedColumnKeys)[0];
      const selectedColumn =
        activeColumns.find(
          (column) =>
            column.key === selectedKey,
        );
      columnsButtonText.textContent =
        selectedColumn?.label ||
        labels.noColumns;
    } else {
      columnsButtonText.textContent =
        `${selectedColumnKeys.size} columnas`;
    }

    clearButton.disabled =
      isDisabled ||
      (searchInput.value === "" &&
        allSelected);
  };

  const createCheckboxOption = ({
    label,
    key,
    isAll = false,
  }) => {
    const option = createElement(
      "label",
      "table-filter__column-option",
    );
    option.setAttribute(
      "role",
      "option",
    );

    const checkbox =
      document.createElement("input");
    checkbox.type = "checkbox";

    if (isAll) {
      checkbox.dataset.tableFilterAll =
        "true";
    } else {
      checkbox.dataset.tableFilterColumn =
        key;
    }

    const optionText = createElement(
      "span",
      "",
      label,
    );
    option.append(checkbox, optionText);

    return option;
  };

  const renderColumnOptions = () => {
    columnsMenu.replaceChildren();

    columnsMenu.appendChild(
      createCheckboxOption({
        label: labels.allColumns,
        isAll: true,
      }),
    );

    activeColumns.forEach((column) => {
      columnsMenu.appendChild(
        createCheckboxOption({
          label: column.label,
          key: column.key,
        }),
      );
    });

    syncColumnControls();
  };

  const filterItems = (items) =>
    filterTableItems({
      items,
      columns: activeColumns,
      selectedColumnKeys,
      query: searchInput.value,
      getValue,
    });

  const apply = () => {
    if (isDestroyed) {
      return {
        matchingItems: [],
        totalItems: 0,
      };
    }

    beforeApply();

    const items = Array.from(
      getItems() || [],
    );
    const matchingItems =
      filterTableItems({
        items,
        columns: activeColumns,
        selectedColumnKeys,
        query: searchInput.value,
        getValue,
      });
    const matchingSet =
      new Set(matchingItems);

    items.forEach((item) => {
      const isVisible =
        matchingSet.has(item);

      if (
        typeof setItemVisibility ===
        "function"
      ) {
        setItemVisibility(
          item,
          isVisible,
        );
      } else if (item?.classList) {
        item.classList.toggle(
          "table-filter-row-hidden",
          !isVisible,
        );
      }
    });

    resultStatus.textContent =
      labels.results(
        matchingItems.length,
        items.length,
      );
    syncColumnControls();

    const detail = {
      query: searchInput.value,
      selectedColumnKeys:
        Array.from(selectedColumnKeys),
      matchingItems,
      totalItems: items.length,
    };

    onChange(detail);

    return detail;
  };

  const setColumns = (
    nextColumns,
    {
      preserveSelection = false,
      clearQuery = false,
    } = {},
  ) => {
    const normalizedColumns =
      normalizeColumns(nextColumns);
    const availableKeys = new Set(
      normalizedColumns.map(
        (column) => column.key,
      ),
    );

    activeColumns = normalizedColumns;

    selectedColumnKeys =
      preserveSelection
        ? new Set(
            Array.from(
              selectedColumnKeys,
            ).filter((key) =>
              availableKeys.has(key),
            ),
          )
        : new Set(availableKeys);

    if (clearQuery) {
      searchInput.value = "";
    }

    renderColumnOptions();

    return apply();
  };

  const selectColumns = (keys) => {
    const availableKeys = new Set(
      activeColumns.map(
        (column) => column.key,
      ),
    );

    selectedColumnKeys = new Set(
      Array.from(keys || [])
        .map(String)
        .filter((key) =>
          availableKeys.has(key),
        ),
    );

    syncColumnControls();

    return apply();
  };

  const clear = () => {
    searchInput.value = "";
    selectedColumnKeys = new Set(
      activeColumns.map(
        (column) => column.key,
      ),
    );
    renderColumnOptions();
    closeColumnsMenu();

    return apply();
  };

  const getState = () => ({
    query: searchInput.value,
    selectedColumnKeys:
      Array.from(selectedColumnKeys),
    columns: activeColumns.slice(),
  });

  const setDisabled = (disabled) => {
    isDisabled = Boolean(disabled);
    columnsButton.disabled = isDisabled;
    searchInput.disabled = isDisabled;

    if (isDisabled) {
      closeColumnsMenu();
    }

    syncColumnControls();
  };

  const setResultSummary = (value) => {
    resultStatus.textContent =
      String(value ?? "");
  };

  const handleDocumentClick = (event) => {
    if (!root.contains(event.target)) {
      closeColumnsMenu();
    }
  };

  const handleDocumentKeydown = (
    event,
  ) => {
    if (event.key === "Escape") {
      closeColumnsMenu();
      columnsButton.focus();
    }
  };

  columnsButton.addEventListener(
    "click",
    () => {
      const willOpen =
        columnsMenu.hidden;
      columnsMenu.hidden = !willOpen;
      columnsButton.setAttribute(
        "aria-expanded",
        String(willOpen),
      );
    },
  );

  columnsMenu.addEventListener(
    "change",
    (event) => {
      const checkbox = event.target;

      if (
        checkbox?.dataset
          ?.tableFilterAll
      ) {
        selectedColumnKeys =
          checkbox.checked
            ? new Set(
                activeColumns.map(
                  (column) =>
                    column.key,
                ),
              )
            : new Set();
      } else {
        const key =
          checkbox?.dataset
            ?.tableFilterColumn;

        if (!key) {
          return;
        }

        if (checkbox.checked) {
          selectedColumnKeys.add(key);
        } else {
          selectedColumnKeys.delete(key);
        }
      }

      syncColumnControls();
      apply();
    },
  );

  searchInput.addEventListener(
    "input",
    apply,
  );
  clearButton.addEventListener(
    "click",
    clear,
  );
  document.addEventListener(
    "click",
    handleDocumentClick,
  );
  document.addEventListener(
    "keydown",
    handleDocumentKeydown,
  );

  setColumns(columns);

  return {
    apply,
    clear,
    destroy: () => {
      if (isDestroyed) {
        return;
      }

      isDestroyed = true;
      document.removeEventListener(
        "click",
        handleDocumentClick,
      );
      document.removeEventListener(
        "keydown",
        handleDocumentKeydown,
      );
      root.remove();
    },
    getState,
    filterItems,
    root,
    searchInput,
    selectColumns,
    setDisabled,
    setColumns,
    setResultSummary,
  };
};
