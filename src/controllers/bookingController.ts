import Booking from '../models/booking';
import Meetings from '../models/meetings';
import mongoose from 'mongoose'


export const bookevent = async (req: any, res: any) => {
  try {
    const { eventId, email, name, contactNo } = req.body;

    if (!eventId || !email || !name || !contactNo) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Atomically check if the event is available and mark it as booked
    const event = await Meetings.findOneAndUpdate(
      { eventId: eventId, isBooked: false },
      { isBooked: true },
      { new: true }
    );

    if (!event) {
      return res.status(400).json({ message: 'Event already booked or not found' });
    }

    // Convert eventId to ObjectId for Booking schema
    const eventIdObjectId = new mongoose.Types.ObjectId(event._id);

    // Create a new booking
    const newBooking = new Booking({ eventId: eventIdObjectId, email, name, contactNo });
    const bookingResult = await newBooking.save();

    // Update the event with booking details
    event.bookingId = bookingResult._id;
    await event.save();

    res.status(201).json({ message: 'Event booked successfully', booking: bookingResult });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};