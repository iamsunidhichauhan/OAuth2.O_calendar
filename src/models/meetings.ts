// src/models/meetings.ts
import mongoose from 'mongoose';

const meetingsSchema = new mongoose.Schema({
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
  eventId: {
    type: String,
  //   type: mongoose.Schema.Types.ObjectId,
  //   required: true, 
  },
    bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false,
  },
});

const Meetings = mongoose.model('Meetings', meetingsSchema); 

export default Meetings;
