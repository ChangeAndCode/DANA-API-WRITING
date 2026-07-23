const adminUploadSection = document.getElementById(
  "adminUploadSection",
);

const scopeMessage = document.getElementById(
  "scopeMessage",
);

const masterSiteColumnHeader = document.getElementById(
  "masterSiteColumnHeader",
);

const masterSiteFilterContainer = document.getElementById(
  "masterSiteFilterContainer",
);

const formatSite = (site) => {
  const siteLabels = {
    gaiim: "GAIIM",
    p1a: "P1A",
  };

  return siteLabels[site] || site;
};

const loadCurrentUser = async () => {
  try {
    const response = await fetch("/api/user/profile");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "No fue posible consultar el usuario.",
      );
    }

    const user = data.user;
    const isAdmin = user.role === "admin";

    if (isAdmin) {
      adminUploadSection.classList.remove("hidden");
      masterSiteColumnHeader.classList.remove("hidden");
      masterSiteFilterContainer.classList.remove("hidden");

      scopeMessage.textContent =
        "Como administrador podrás consultar archivos de todas las sedes.";
    } else {
      adminUploadSection.classList.add("hidden");
      masterSiteColumnHeader.classList.add("hidden");
      masterSiteFilterContainer.classList.add("hidden");

      scopeMessage.textContent = user.site
        ? `Mostrando archivos disponibles para la sede: ${formatSite(user.site)}.`
        : "No tienes una sede asignada.";
    }
  } catch (error) {
    console.error("Error al cargar el perfil:", error);
    window.location.href = "/auth/login";
  }
};

document.addEventListener(
  "DOMContentLoaded",
  loadCurrentUser,
);