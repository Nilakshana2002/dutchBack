import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  package: {
    type: String,
    enum: ['full-board', 'day-use', 'room-only', 'bb', 'hb', 'fb'],
    default: 'full-board',
  },
  roomNumber: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['deluxe', 'luxury', 'semiluxury', 'dayOuting', 'couple'],
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  guests: {
    type: Number,
    required: true,
    min: 1,
  },
  description: {
    type: String,
    required: true,
  },
  tagline: {
    type: String,
    default: '',
  },
  tags: [{
    type: String,
  }],
  capacity: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: '',
  },
  badge: {
    type: String,
    default: '',
  },
  badgeColor: {
    type: String,
    default: 'bg-blue-500',
  },
  features: [{
    type: String,
  }],
  facilities: [{
    icon: { type: String, default: '' },
    label: { type: String, default: '' },
  }],
  includes: [{
    type: String,
  }],
  image: {
    type: String,
    required: true,
  },
  images: [{
    type: String,
  }],
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied', 'maintenance'],
    default: 'available',
  },
  view: {
    type: String,
    default: 'ocean',
  },
}, {
  timestamps: true,
})

const Room = mongoose.model('Room', roomSchema)

export default Room
