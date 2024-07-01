import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meetings',
    required: true,
  },
  email: { type: String, required: true },
  name: { type: String, required: true },
  contactNo: { type: String, required: true },
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;

