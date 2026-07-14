import mongoose from 'mongoose';

const mealPlanSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true, // e.g., 'bb', 'hb', 'fb', 'room-only'
  },
  label: {
    type: String,
    required: true,
    trim: true, // e.g., 'Bed & Breakfast'
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
  },
  includes: [{
    type: String,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const MealPlan = mongoose.model('MealPlan', mealPlanSchema);

export default MealPlan;
