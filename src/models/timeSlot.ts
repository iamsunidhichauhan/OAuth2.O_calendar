import mongoose from 'mongoose';

const timeSlotSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  isBooked: { type: Boolean, default: false },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false,
  },
});

const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);

export default TimeSlot;
