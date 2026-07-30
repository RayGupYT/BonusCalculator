const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    // Bonus dial settings: bonus starts at dialMin + (dialMax - dialMin) * thresholdPct/100.
    dialMin: { type: Number, min: 0, default: 0 },
    dialMax: { type: Number, min: 0, default: 1000000 },
    thresholdPct: { type: Number, min: 0, max: 100, default: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', employeeSchema);
