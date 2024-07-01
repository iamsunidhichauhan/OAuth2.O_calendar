// authcontroller.ts:

import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import User from "../models/user";
import CalendarAssociation from "../models/calendarAssociations";
import Meetings from "../models/meetings";
import * as validator from '../validations/validator';
import { encodeToken, decodeToken } from '../utilities/utils';

require('dotenv').config(); 

const secretKey = "secret_Key";
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Helper function to check if tokens are valid
const areTokensValid = (accessToken: string | undefined, refreshToken: string | undefined): boolean => {
  return !!accessToken && !!refreshToken;
};

export const signup = async (req: Request, res: Response) => {
  try {
    const errors =[];
    const { email, name, contactNo, password, role } = req.body;

    if (!validator.nameRegex.test(name)) {
      errors.push( "Invalid name format" );
    }
    if (!validator.emailRegex.test(email)) {
      errors.push(  "Invalid email format" );
    }
    if (!validator.passwordRegex.test(password)) {
      errors.push( "Invalid password format" );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }
    // If there are any errors
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      name,
      contactNo,
      password: hashedPassword,
      role,
    });
    await newUser.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error: any) {
    res.status(500).json({ message: `Error creating user: ${error.message}` });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      secretKey,
      { expiresIn: "24h" }
    );

    user.token = token; 
    await user.save(); 

    res.status(200).json({ message: "Login successful", user });
  } catch (error: any) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: `Error logging in: ${error.message}` });
  }
};

export const provideAccess = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const decoded = jwt.verify(token, secretKey) as any;
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state: JSON.stringify({ email: user.email }),
    });

    res.status(200).json({ authUrl });
  } catch (error: any) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ message: `Error generating auth URL: ${error.message}` });
  }
};
// OAuth Callback
export async function oauth2callback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state } = req.query;
    const { email } = JSON.parse(state as string);
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);

    // Find the user by email
    const user = await User.findOne({ email });

    if (user) {
      // Save tokens to user
      user.accessToken = encodeToken(tokens.access_token!);
      user.refreshToken = encodeToken(tokens.refresh_token!);
      await user.save(); // Save user updates to database

      res.send("OAuth callback successful! You can now create a calendar.");
    } else {
      res.status(400).json({ message: "User not found" });
    }
  } catch (error: any) {
    console.error("Error during OAuth2 callback:", error);
    res.status(500).json({ message: `Error during OAuth2 callback: ${error.message}` });
  }
}

export const createNewCalendar = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const decoded = jwt.verify(token, secretKey) as any;
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const { calendarName, email } = req.body;

    if (!calendarName || !email) {
      return res.status(400).json({ message: "Calendar name and email are required" });
    }

    if (user.email !== email) {
      return res.status(403).json({ message: "Email does not match the authenticated user" });
    }

    if (!user.accessToken || !user.refreshToken) {
      return res.status(403).json({ message: "Please provide Google Calendar access" });
    }

    // Set OAuth credentials for the client using existing tokens
    oauth2Client.setCredentials({
      access_token: decodeToken(user.accessToken) as string,
      refresh_token: decodeToken(user.refreshToken) as string,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const newCalendar = {
      summary: calendarName,
      timeZone: "Asia/Kolkata",
    };

    // Create a new calendar
    const response = await calendar.calendars.insert({
      requestBody: newCalendar,
    });

    // Save the calendar association
    await CalendarAssociation.create({
      userId: user._id,
      calendarId: response.data.id,
      calendarName: calendarName,
    });

    res.status(201).json({ message: "Calendar created successfully", calendarId: response.data.id });
  } catch (error: any) {
    console.error("Error creating new calendar:", error);
    res.status(500).json({ message: `Error creating new calendar: ${error.message}` });
  }
};

export const assignCalendar = async (req: Request, res: Response) => {
  try {
    const { adminEmail, employeeEmail, calendarName, calendarId } = req.body;

    // Ensure the admin exists
    const admin = await User.findOne({ email: adminEmail, role: 'admin' });
    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    // Ensure the employee exists
    const employee = await User.findOne({ email: employeeEmail, role: 'employee' });
    if (!employee) {
      return res.status(400).json({ message: "Employee not found" });
    }

    // Create calendar association
    await CalendarAssociation.findOneAndUpdate(
      { calendarId },
      {
        userId: employee._id, // Add userId for association
        calendarName,
        assignedBy: admin._id,
      },
      { upsert: true, new: true } // Upsert and return the updated document
    );

    res.status(200).json({ message: "Calendar assigned successfully" });
  } catch (error: any) {
    console.error("Error assigning calendar:", error);
    res.status(500).json({ message: `Error assigning calendar: ${error.message}` });
  }
};

export const createEvent = async (req: Request, res: Response) => {
  try {
    const { email, calendarName, date, startTime, endTime, summary, description } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Find the calendar association by calendar name
    const association = await CalendarAssociation.findOne({ calendarName });
    console.log("association is:", association);

    if (!association) {
      return res.status(400).json({ message: "Calendar not found for the specified user" });
    }

    // Find the associated user by the assignedBy field in CalendarAssociation
    const assignedByUser = await User.findById(association.assignedBy);

    if (!assignedByUser) {
      return res.status(400).json({ message: "Assigned by user not found" });
    }

    // Set OAuth credentials for the client using existing tokens from the associated user
    oauth2Client.setCredentials({
      access_token: decodeToken(assignedByUser.accessToken!) as string || '',
      refresh_token: decodeToken(assignedByUser.refreshToken!) as string || '',
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const event = {
      summary,
      description,
      start: {
        dateTime: new Date(`${date}T${startTime}`).toISOString(),
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: new Date(`${date}T${endTime}`).toISOString(),
        timeZone: "Asia/Kolkata",
      },
    };

    // Insert event into Google Calendar
    const response = await calendar.events.insert({
      calendarId: association.calendarId,
      requestBody: event,
    });

    // Save the event details in MongoDB
    const meeting = new Meetings({
      creator: user._id,
      date: new Date(`${date}T00:00:00Z`),
      startTime,
      endTime,
      title: summary,
      description,
      eventId: response.data.id,
      bookingId: null,
    });

    await meeting.save();

    res.status(201).json({ message: "Event created successfully", eventId: response.data.id });
  } catch (error: any) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: `Error creating event: ${error.message}` });
  }
};

export const viewCalendar = async (req: any, res: Response) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const associations = await CalendarAssociation.find({ userId: user._id }).populate('userId', 'email role');
    
    if (req.user.role === 'employee' && req.user.email !== email) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json({ calendars: associations });
  } catch (error: any) {
    console.error("Error viewing calendar:", error);
    res.status(500).json({ message: `Error viewing calendar: ${error.message}` });
  }
};