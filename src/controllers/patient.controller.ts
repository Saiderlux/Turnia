import { Request, Response, NextFunction } from 'express';
import * as patientService from '../services/patient.service';

export async function listPatients(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const patients = await patientService.listPatients(search);
    return res.json(patients);
  } catch (err) {
    return next(err);
  }
}

export async function createPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await patientService.createPatient(req.body);
    return res.status(201).json(patient);
  } catch (err) {
    return next(err);
  }
}

export async function updatePatient(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const patient = await patientService.updatePatient(id, req.body);
    return res.json(patient);
  } catch (err) {
    return next(err);
  }
}

export async function deletePatient(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await patientService.deletePatient(id);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}
