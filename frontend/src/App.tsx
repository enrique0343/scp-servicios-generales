import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Plantilla from './pages/Plantilla';
import PlanMensual from './pages/PlanMensual';
import SnapshotDiario from './pages/SnapshotDiario';
import Excepciones from './pages/Excepciones';

export default function App() {
  const { step } = useAuth();

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-alt">
        <div className="text-secundario text-sm">Cargando...</div>
      </div>
    );
  }

  if (step === 'email' || step === 'otp') {
    return <Login />;
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
