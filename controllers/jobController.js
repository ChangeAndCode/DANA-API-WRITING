const conversionJobRepository = require("../repositories/conversionJobRepository");

const isAdminUser = (user) => {
  return !!(user && (user.isAdmin || user.role === "admin"));
};

const normalizeUserSite = (site) => {
  return typeof site === "string" ? site.trim() : "";
};

const getUserConversionJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const userSite = normalizeUserSite(req.user.site);

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    let data;
    if (isAdminUser(req.user)) {
      data = await conversionJobRepository.getPaginatedAllJobs(page, limit);
    } else {
      data = await conversionJobRepository.getPaginatedJobsForUserScope(
        {
          userId,
          site: userSite || undefined,
        },
        page,
        limit,
      );
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching conversion jobs:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor al obtener el historial." });
  }
};

module.exports = {
  getUserConversionJobs,
};