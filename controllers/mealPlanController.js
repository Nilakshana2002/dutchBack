import MealPlan from '../models/MealPlan.js';

// @desc    Get all active meal plans
// @route   GET /api/meal-plans
// @access  Public
export const getMealPlans = async (req, res) => {
  try {
    const mealPlans = await MealPlan.find({ isActive: true });
    res.json(mealPlans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Seed initial meal plans
// @route   POST /api/meal-plans/seed
// @access  Private/Admin
export const seedMealPlans = async (req, res) => {
  try {
    const defaultPlans = [
      {
        code: 'room-only',
        label: 'Room Only',
        rate: 0,
        includes: ['No meals included'],
      },
      {
        code: 'bb',
        label: 'Bed & Breakfast',
        rate: 1500,
        includes: ['Breakfast only'],
      },
      {
        code: 'hb',
        label: 'Half Board',
        rate: 4000,
        includes: ['Breakfast and Lunch'],
      },
      {
        code: 'fb',
        label: 'Full Board',
        rate: 6000,
        includes: ['Breakfast', 'Lunch', 'Tea or Coffee', 'Dinner'],
      }
    ];

    await MealPlan.deleteMany({});
    const createdPlans = await MealPlan.insertMany(defaultPlans);
    res.status(201).json(createdPlans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
