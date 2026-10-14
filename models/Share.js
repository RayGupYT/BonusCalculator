const mongoose = require('mongoose');

// A read-only report link. The token is the capability: anyone holding the URL
// can read that one employee's report for that one year, and nothing else.
// It is stored as-is (not hashed) so the owner can copy the link again later;
// revoking means deleting the document, which breaks the URL immediately.
const shareSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    // The report is pinned to one year; revenue inside it stays live.
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    lastViewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Share', shareSchema);
