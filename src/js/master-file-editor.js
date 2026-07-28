const masterEditorMessage =
  document.getElementById(
    "masterEditorMessage",
  );

const masterEditorPanel =
  document.getElementById(
    "masterEditorPanel",
  );

const masterEditorSitesGroup =
  document.getElementById(
    "masterEditorSitesGroup",
  );

const masterEditorScopeMessage =
  document.getElementById(
    "masterEditorScopeMessage",
  );

const showEditorMessage = (
  message,
  type = "",
) => {
  masterEditorMessage.textContent =
    message;

  masterEditorMessage.classList.remove(
    "success",
    "error",
    "warning",
  );

  if (type) {
    masterEditorMessage.classList.add(
      type,
    );
  }

  masterEditorMessage.style.display =
    message ? "block" : "none";
};

const getMasterFileId = () => {
  const urlParameters =
    new URLSearchParams(
      window.location.search,
    );

  return String(
    urlParameters.get("edit") || "",
  ).trim();
};

const isValidObjectId = (value) =>
  /^[a-f0-9]{24}$/i.test(value);

const loadCurrentUser = async () => {
  const response = await fetch(
    "/api/user/profile",
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok || !data.user) {
    throw new Error(
      data.message ||
        "No fue posible consultar el usuario.",
    );
  }

  return data.user;
};

const initializeMasterEditor =
  async () => {
    const masterFileId =
      getMasterFileId();

    if (!isValidObjectId(masterFileId)) {
      showEditorMessage(
        "El identificador del archivo madre no es válido.",
        "error",
      );

      return;
    }

    try {
      const currentUser =
        await loadCurrentUser();

      const isAdmin =
        currentUser.role === "admin";

      if (isAdmin) {
        masterEditorSitesGroup.classList.remove(
          "hidden",
        );

        masterEditorScopeMessage.textContent =
          "Como administrador podrás modificar el nombre, las sedes y el contenido.";
      } else {
        masterEditorScopeMessage.textContent =
          "Podrás modificar el contenido de los archivos disponibles para tu sede.";
      }

      masterEditorPanel.classList.remove(
        "hidden",
      );

      showEditorMessage(
        "La ruta del editor se cargó correctamente.",
        "success",
      );
    } catch (error) {
      showEditorMessage(
        error.message ||
          "No fue posible preparar el editor.",
        "error",
      );
    }
  };

document.addEventListener(
  "DOMContentLoaded",
  initializeMasterEditor,
);