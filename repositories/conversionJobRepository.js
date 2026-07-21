const ConversionJob = require("../models/ConversionJob");

const normalizeUserSite = (site) => {
  return typeof site === "string" ? site.trim() : "";
};

// createConversionJob and getConversionJobById remain the same...
const createConversionJob = async ({
  userId,
  site,
  fileName,
  originalFilePath,
  outputFormat,
  conversionOptions,
  status,
  isAutomated = false,
}) => {
  const newJob = new ConversionJob({
    userId,
    site,
    fileName,
    originalFilePath,
    outputFormat,
    conversionOptions,
    status,
    isAutomated,
  });
  return await newJob.save();
};

const getConversionJobById = async (jobId) => {
  return await ConversionJob.findById(jobId);
};

/**
 * UPDATED: Finds paginated conversion jobs for a specific user ID.
 */
const getPaginatedJobsForUserScope = async (
  { userId, site },
  page = 1,
  limit = 10,
) => {
  const skip = (page - 1) * limit;
  const normalizedSite = normalizeUserSite(site);

  const query = normalizedSite
    ? {
        isAutomated: false,
        $or: [
          { site: normalizedSite },
          { userId: userId, site: { $exists: false } },
        ],
      }
    : {
        userId: userId,
        isAutomated: false,
      };

  const [jobs, totalJobs] = await Promise.all([
    ConversionJob.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ConversionJob.countDocuments(query),
  ]);

  return {
    jobs,
    totalJobs,
    currentPage: page,
    totalPages: Math.ceil(totalJobs / limit),
  };
};

/**
 * UPDATED: Finds all paginated conversion jobs in the database (for admins).
 */
const getPaginatedAllJobs = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [jobs, totalJobs] = await Promise.all([
    ConversionJob.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ConversionJob.countDocuments({}),
  ]);

  return {
    jobs,
    totalJobs,
    currentPage: page,
    totalPages: Math.ceil(totalJobs / limit),
  };
};

// updateConversionJobStatus remains the same...
const updateConversionJobStatus = async (
  jobId,
  status,
  {
    convertedFilePath = null,
    errorReportPath = null,
    remoteConvertedPath = null,
    remoteErrorPath = null,
    completedAt = null,
    errorMessage = null,
  } = {}
) => {
  const updateFields = { status };
  if (convertedFilePath) updateFields.convertedFilePath = convertedFilePath;
  if (errorReportPath) updateFields.errorReportPath = errorReportPath;
  if (remoteConvertedPath) updateFields.remoteConvertedPath = remoteConvertedPath;
  if (remoteErrorPath) updateFields.remoteErrorPath = remoteErrorPath;
  if (completedAt) updateFields.completedAt = completedAt;
  if (errorMessage) updateFields.errorMessage = errorMessage;

  return await ConversionJob.findByIdAndUpdate(
    jobId,
    { $set: updateFields },
    { new: true }
  );
};

const deleteJobsByUserId = async (userId, session = null) => {
  const options = session ? { session } : {};
  return await ConversionJob.deleteMany({ userId: userId }, options);
};

/**
 * Obtiene el ultimo job automatizado para un archivo y tipo de documento,
 * incluyendo la ruta remota del ultimo CSV subido (para poder borrarlo).
 */
const getLatestAutomatedJobByFileNameAndDocType = async (
  fileName,
  documentType
) => {
  return await ConversionJob.findOne({
    fileName,
    isAutomated: true,
    "conversionOptions.documentType": documentType,
    remoteConvertedPath: { $exists: true },
  })
    .sort({ createdAt: -1 })
    .lean();
};

const getLatestAutomatedJobByFileName = async (fileName) => {
  return await ConversionJob.findOne({
    fileName,
    isAutomated: true,
  })
    .sort({ createdAt: -1 })
    .lean();
};

module.exports = {
  createConversionJob,
  getConversionJobById,
  updateConversionJobStatus,
  getPaginatedJobsForUserScope,
  getPaginatedAllJobs,
  deleteJobsByUserId,
  getLatestAutomatedJobByFileNameAndDocType,
  getLatestAutomatedJobByFileName,
};