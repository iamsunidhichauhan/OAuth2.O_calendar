import { Request, Response } from 'express';
import User from "../models/user";
import bcrypt from 'bcrypt';
import TimeSlot from '../models/meetings';



// Create user function
export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, name, contactNo, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      email,
      name,
      contactNo,
      password: hashedPassword,
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    res.status(200).json({ message: "User created successfully", savedUser });
  } catch (error: any) {
    res.status(500).json({ message: `Error creating user: ${error.message}` });
  }
};




export const findSlots = async (req: Request, res: Response) => {
  try {
    const { unbooked } = req.query; 

    let query = {};
    if (unbooked === 'true') {
      query = { isBooked: false };
    } else if (unbooked === 'false') {
      query = { isBooked: true };
    }

    const slots = await TimeSlot.find(query);

    res.status(200).json({ slots });
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving slots: ${error.message}` });
  }
};
