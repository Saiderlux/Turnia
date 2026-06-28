import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError } from '../utils/errors';
import { Role } from '@prisma/client';

interface JwtPayload {
  id: string;
  role: Role;
  doctorId?: string | null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AuthError('Token de autenticación requerido'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    req.user = { id: payload.id, role: payload.role, doctorId: payload.doctorId };
    return next();
  } catch {
    return next(new AuthError('Token inválido o expirado'));
  }
}
