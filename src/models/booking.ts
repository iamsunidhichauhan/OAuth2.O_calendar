import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  slotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimeSlot',
    required: true,
  },
  email: { type: String, required: true },
  name: { type: String, required: true },
  contactNo: { type: String, required: true },
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
