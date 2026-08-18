const mongoose = require("mongoose");
const { VALID_SITES } = require("../data/siteConfig");

const SFTP_STATUSES = Object.freeze([
  "not_sent",
  "pending",
  "sending",
  "sent",
  "failed",
]);

const sftpDeliverySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: SFTP_STATUSES,
      default: "not_sent",
      index: true,
    },
    site: {
      type: String,
      enum: VALID_SITES,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAttemptAt: Date,
    operationId: {
      type: String,
      trim: true,
      select: false,
    },
    lockExpiresAt: {
      type: Date,
      select: false,
    },
    sentAt: Date,
    lastAttemptBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastError: {
      type: String,
      default: "",
      maxlength: 500,
    },
    remoteFileName: {
      type: String,
      trim: true,
    },
    remotePath: {
      type: String,
      trim: true,
      select: false,
    },
    lastDryRunAt: Date,
    lastDryRunSite: {
      type: String,
      enum: VALID_SITES,
    },
    lastDryRunBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastDryRunSucceeded: Boolean,
    lastDryRunError: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  {
    _id: false,
  },
);

module.exports = {
  SFTP_STATUSES,
  sftpDeliverySchema,
};
