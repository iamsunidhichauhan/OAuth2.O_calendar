// calendarAssociation.ts
import mongoose from 'mongoose';

const calendarAssociationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  calendarId: {
    type: String,
    required: true,
  },
  calendarName:{
    type: String
  },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

});

const CalendarAssociation = mongoose.model('CalendarAssociation', calendarAssociationSchema);

export default CalendarAssociation;
