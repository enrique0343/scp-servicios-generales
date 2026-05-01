import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Plantilla from './pages/Plantilla';
import PlanMensual from './pages/PlanMensual';
import SnapshotDiario from './pages/SnapshotDiario';
import Excepciones from './pages/Excepciones';

export default function App() {
  const { isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-secundario text-sm">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-danger font-semibold">Error de autenticación</p>
          <p className="text-secundario text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="plantilla" element={<Plantilla />} />
        <Route path="plan/:yyyymm?" element={<PlanMensual />} />
        <Route path="asistencia/:fecha?" element={<SnapshotDiario />} />
        <Route path="excepciones" element={<Excepciones />} />
      </Route>
    </Routes>
  );
}
