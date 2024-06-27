// userSchema.ts

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    // unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactNo: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken:{
    type : String,
  },
  refreshToken:{
    type: String
  },
  calendarId:{
    type :String
  },
  token:{
    type :String
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

export default User;
