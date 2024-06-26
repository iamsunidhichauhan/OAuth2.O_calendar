import Booking from '../models/booking';
import TimeSlot from '../models/timeSlot';


export const bookSlot = async (req:any, res:any) => {
  let errors = [];

  try {
  const { slotId, email, name, contactNo } = req.body;


  if (!slotId || !email || !name || !contactNo) {
    return res.status(400).json({ message: 'All fields are required' });
  }

    // Atomically check if the slot is available and mark it as booked
    const slot = await TimeSlot.findOneAndUpdate(
      { _id: slotId, isBooked: false },
      { isBooked: true },
      { new: true }
    );

    if (!slot) {
      return res.status(400).json({ message: 'Slot already booked or not found' });
    }

    // Create a new booking
    const newBooking = new Booking({ slotId, email, name, contactNo });
    const bookingResult = await newBooking.save();

    // Update the time slot with booking details
    slot.bookingId = bookingResult._id;
    await slot.save();

    res.status(201).json({ message: 'Slot booked successfully', booking: bookingResult });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};
