// models/ConversionJob.js
const mongoose = require('mongoose');

const conversionJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  site: {
    type: String,
    enum: ['gaiim', 'p1a'],
    index: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  originalFilePath: {
    type: String,
    required: true,
  },
  outputFormat: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'completed_with_errors'],
    default: 'pending',
  },
  convertedFilePath: String,
  errorReportPath: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
  conversionOptions: Object,
  errorMessage: String,
});

module.exports = mongoose.model('ConversionJob', conversionJobSchema);
