import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { AppError } from './utils/errors';
import { startNoshowJob } from './jobs/noshow.job';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

// Routes (mounted as phases are completed)
import authRouter from './routes/auth';
import appointmentRouter from './routes/appointments';
import reportRouter from './routes/reports';
import doctorRouter from './routes/doctors';
import patientRouter from './routes/patients';

app.use('/api/auth', authRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/reports', reportRouter);
app.use('/api/doctors', doctorRouter);
app.use('/api/patients', patientRouter);

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  console.error(err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
  });
});

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startNoshowJob();
});

export default app;
