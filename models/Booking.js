import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  guestInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    specialRequests: { type: String },
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  mealPlan: {
    type: String,
    enum: ['Room Only', 'BB', 'HB', 'FB', 'Not Specified'],
    default: 'Not Specified',
  },
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    required: true,
  },
  guests: {
    type: Number,
    required: true,
    min: 1,
  },
  nights: {
    type: Number,
    required: true,
  },
  subtotal: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  offerCode: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'reserved', 'checked_in', 'checked_out', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    default: 'card',
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'fully_paid', 'refunded'],
    default: 'pending',
  },
  paymentDetails: {
    cardLast4: { type: String },
    cardBrand: { type: String },
    transactionId: { type: String },
  },
  paymentDate: {
    type: Date,
  },
}, {
  timestamps: true,
})

const Booking = mongoose.model('Booking', bookingSchema)

export default Booking
