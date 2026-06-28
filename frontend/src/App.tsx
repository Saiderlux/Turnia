import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AdminAgendaPage } from './pages/AdminAgendaPage';
import { ReportesPage } from './pages/ReportesPage';
import { DoctorAgendaPage } from './pages/DoctorAgendaPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/admin/agenda"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminAgendaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reportes"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']}>
              <ReportesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/agenda"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorAgendaPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
