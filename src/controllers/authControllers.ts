// authcontroller.ts:

import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import User from "../models/user";
import TimeSlot from "../models/timeSlot";
import * as validator from '../validations/validator';
import { encodeToken, decodeToken } from '../utilities/utils';

require('dotenv').config(); 

const secretKey = "secret_Key";
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const signup = async (req: Request, res: Response) => {
  try {
    const errors =[];
    const { email, name, contactNo, password } = req.body;

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

export async function oauth2callback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state } = req.query;
    const { email } = JSON.parse(state as string);
    const { tokens } = await oauth2Client.getToken(code as string);

    const user = await User.findOne({ email });

    if (user) {
      user.accessToken = encodeToken(tokens.access_token!);
      user.refreshToken = encodeToken(tokens.refresh_token!);
      await user.save();

      oauth2Client.setCredentials({
        access_token: decodeToken(user.accessToken),
        refresh_token: decodeToken(user.refreshToken),
      });

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      const newCalendar = {
        summary: "My App Calendar",
        timeZone: "Asia/Kolkata",
      };

      const response = await calendar.calendars.insert({
        requestBody: newCalendar,
      });

      user.calendarId = response.data.id;
      await user.save();

      res.send("OAuth callback successful! Calendar created. You can close this window.");
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
    console.log(1)
    const token = req.headers.authorization; 
    console.log(token)
    if (!token) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const decoded = jwt.verify(token, secretKey) as any;
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/calendar"],
      state: JSON.stringify({ email: user.email }),
    });

    res.status(200).json({ authUrl });
  } catch (error: any) {
    console.error("Error creating new calendar:", error);
    res.status(500).json({ message: `Error creating new calendar: ${error.message}` });
  }
};

export const createEvent = async (req: Request, res: Response) => {
  try {
    const { email, date, startTime, endTime, summary, description } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.accessToken || !user.calendarId || !user.refreshToken) {
      return res
        .status(400)
        .json({
          message: "User not authenticated with Google or calendar not created",
        });
    }
    
    oauth2Client.setCredentials({
      access_token: decodeToken(user.accessToken),
      refresh_token: decodeToken(user.refreshToken),
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

    const response = await calendar.events.insert({
      calendarId: user.calendarId, 
      requestBody: event,
    });

    // Save the time slot details in MongoDB
    const timeSlot = new TimeSlot({
      creator: user._id,
      date: new Date(date),
      startTime,
      endTime,
      title: summary,
      description,
      isBooked: false,
    });

    await timeSlot.save();

    res.status(201).json({ event: response.data, timeSlot });
  } catch (error: any) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: `Error creating event: ${error.message}` });
  }
};
