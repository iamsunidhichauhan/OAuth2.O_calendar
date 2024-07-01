import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user';

const secretKey = 'my_secret_key';

export const authorize = (roles: string[]) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: "Authorization token missing" });
      }

      const decoded = jwt.verify(token, secretKey) as any;
      const user = await User.findById(decoded.userId);
      if (!user || !roles.includes(user.role!)) {
        return res.status(403).json({ message: "Access denied" });
      }

      req.user = user;
      next();
    } catch (error: any) {
      console.error("Authorization error:", error);
      res.status(500).json({ message: `Authorization error: ${error.message}` });
    }
  };
};
