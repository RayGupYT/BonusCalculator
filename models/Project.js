const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    clientName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    revenue: [
      {
        _id: false,
        year: { type: Number, required: true, min: 2000, max: 2100 },
        month: { type: Number, required: true, min: 1, max: 12 },
        amount: { type: Number, required: true, min: 0, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
