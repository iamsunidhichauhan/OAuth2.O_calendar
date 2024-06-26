// authcontroller.ts:

import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import User from "../models/user";
import TimeSlot from "../models/timeSlot";
import * as validator from '../validations/validator';
import { encodeToken, decodeToken } from '../utilities/utils';

require('dotenv').config(); // Load environment variables from .env file

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

export const createNewCalendar = async (user: any) => {
  try {
    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const newCalendar = {
      summary: "My App Calendar",
      timeZone: "Asia/Kolkata",
    };

    const response = await calendar.calendars.insert({
      requestBody: newCalendar,
    });

    // Save the new calendar ID in your database associated with the user
    user.calendarId = response.data.id;
    await user.save();
    return response.data;
  } catch (error) {
    console.error("Error creating new calendar:", error);
    throw error;
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.accessToken || !user.refreshToken) {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/calendar"],
        state: JSON.stringify({ email }),
      });

      return res.json({ authUrl });
    }

    // Check if the calendar is already created
    if (!user.calendarId) {
      await createNewCalendar(user);
    }

    res.status(200).json({ message: "Login successful", user });
  } catch (error: any) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: `Error logging in: ${error.message}` });
  }
};

// export async function oauth2callback(req: Request, res: Response): Promise<void> {
//   try {
//     const { code, state } = req.query;
//     const { email } = JSON.parse(state as string);
//     console.log("email is : ", email );

//     const { tokens } = await oauth2Client.getToken(code as string);
//     console.log("tokens are :", tokens)

//     const user = await User.findOne({ email });
//     console.log("user is:  ", user)

//     if (user) {
//       // Encode tokens before saving
//       user.accessToken = encodeToken(tokens.access_token!);
//       user.refreshToken = encodeToken(tokens.refresh_token!);
//       await user.save();

//       console.log("user with encoded tokens : ", user)

//       // Create a new calendar if not already created
//       if (!user.calendarId) {
//         await createNewCalendar(user);
//       }

//       // Redirect or respond with success message
//       res.send("OAuth callback successful! You can close this window.");
//     } else {
//       res.status(400).json({ message: "User not found" });
//     }
//   } catch (error: any) {
//     console.error("Error during OAuth2 callback:", error);
//     res
//       .status(500)
//       .json({ message: `Error during OAuth2 callback: ${error.message}` });
//   }
// }
export async function oauth2callback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state } = req.query;
    const { email } = JSON.parse(state as string);

    const { tokens } = await oauth2Client.getToken(code as string);

    const user = await User.findOne({ email });

    if (user) {
      user.accessToken = tokens.access_token!;
      user.refreshToken = tokens.refresh_token!;
      await user.save();

      // Create a new calendar if not already created
      if (!user.calendarId) {
        await createNewCalendar(user);
      }

      // Redirect or respond with success message
      res.send("OAuth callback successful! You can close this window.");
    } else {
      res.status(400).json({ message: "User not found" });
    }
  } catch (error: any) {
    console.error("Error during OAuth2 callback:", error);
    res
      .status(500)
      .json({ message: `Error during OAuth2 callback: ${error.message}` });
  }
}

export const createEvent = async (req: Request, res: Response) => {
  try {
    const { email, date, startTime, endTime, summary, description } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.accessToken || !user.calendarId) {
      return res
        .status(400)
        .json({
          message: "User not authenticated with Google or calendar not created",
        });
    }

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
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
