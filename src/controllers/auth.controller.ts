import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { AuthError } from '../utils/errors';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return next(new AuthError('Credenciales incorrectas'));
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, doctorId: user.doctorId },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' } as jwt.SignOptions
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, doctorId: user.doctorId },
    });
  } catch (err) {
    return next(err);
  }
}
