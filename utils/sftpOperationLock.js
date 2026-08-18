const crypto = require("crypto");

const SFTP_IN_PROGRESS_STATUSES = Object.freeze(["pending", "sending"]);

const createSftpOperationId = () => crypto.randomUUID();

const getSftpLeaseExpiry = (timeoutMs, now = new Date()) =>
  new Date(now.getTime() + timeoutMs);

const createSftpAvailableFilter = ({ id, timeoutMs, now = new Date() }) => {
  const staleBefore = new Date(now.getTime() - timeoutMs);
  return {
    _id: id,
    $or: [
      { "sftpDelivery.status": { $nin: SFTP_IN_PROGRESS_STATUSES } },
      { "sftpDelivery.lockExpiresAt": { $lte: now } },
      {
        $and: [
          { "sftpDelivery.status": { $in: SFTP_IN_PROGRESS_STATUSES } },
          { "sftpDelivery.lockExpiresAt": { $exists: false } },
          { "sftpDelivery.lastAttemptAt": { $lt: staleBefore } },
        ],
      },
      {
        $and: [
          { "sftpDelivery.status": { $in: SFTP_IN_PROGRESS_STATUSES } },
          { "sftpDelivery.lockExpiresAt": { $exists: false } },
          { "sftpDelivery.lastAttemptAt": { $exists: false } },
        ],
      },
    ],
  };
};

const createSftpSendAcquisitionFilter = (options) => ({
  ...createSftpAvailableFilter(options),
  "sftpDelivery.status": { $ne: "sent" },
  "masterFileSync.status": { $ne: "applying" },
});

const shouldDeletePreviousRemoteFile = ({
  previousSite,
  previousPath,
  nextSite,
  nextPath,
}) =>
  Boolean(previousPath) &&
  (previousSite !== nextSite || previousPath !== nextPath);

const createSftpOwnerFilter = ({ id, operationId, statuses }) => ({
  _id: id,
  "sftpDelivery.operationId": operationId,
  ...(statuses ? { "sftpDelivery.status": { $in: statuses } } : {}),
});

const isSftpOperationActive = (delivery, timeoutMs, now = new Date()) => {
  if (!SFTP_IN_PROGRESS_STATUSES.includes(delivery?.status)) return false;

  const lockExpiresAt = new Date(delivery?.lockExpiresAt || 0).getTime();
  if (Number.isFinite(lockExpiresAt) && lockExpiresAt > 0) {
    return lockExpiresAt > now.getTime();
  }

  const lastAttemptAt = new Date(delivery?.lastAttemptAt || 0).getTime();
  return (
    Number.isFinite(lastAttemptAt) &&
    lastAttemptAt > 0 &&
    now.getTime() - lastAttemptAt < timeoutMs
  );
};

module.exports = {
  SFTP_IN_PROGRESS_STATUSES,
  createSftpAvailableFilter,
  createSftpOperationId,
  createSftpOwnerFilter,
  createSftpSendAcquisitionFilter,
  getSftpLeaseExpiry,
  isSftpOperationActive,
  shouldDeletePreviousRemoteFile,
};
