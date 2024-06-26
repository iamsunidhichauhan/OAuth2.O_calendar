// index.ts:

// // Import necessary modules and types
// import { google, Auth } from 'googleapis';
import express, { NextFunction, Request, Response } from 'express';
// import session, { SessionData } from "express-session";
// import crypto from "crypto";
import mongoose from 'mongoose';
import { signup, login, oauth2callback, createEvent,createNewCalendar } from './controllers/authControllers';
import { bookSlot } from './controllers/bookingController';
import{findSlots} from './controllers/userController';
import bodyParser from 'body-parser';


// setup express 
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// define routs:
app.post('/signup', signup);
app.post('/login', login);
app.get('/oauth2callback', oauth2callback);
app.post('/create-event', createEvent);
// app.post(`/createNewCalendar`,createNewCalendar)
app.post('/bookSlot',bookSlot)
app.get('/findSlots',findSlots)



// server configuration:
mongoose.connect("mongodb://localhost:27017/calendar_integration")
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
