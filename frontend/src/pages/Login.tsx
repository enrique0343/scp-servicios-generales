import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

export default function Login() {
  const { step, error, submitEmail, submitOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await submitEmail(email);
    setLoading(false);
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await submitOtp(email, code);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-alt">
      <div className="bg-white border border-borde rounded p-8 w-full max-w-sm shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-xs text-secundario uppercase tracking-widest mb-1">Avante</div>
          <h1 className="text-lg font-bold text-primario">Control de Personal</h1>
          <p className="text-xs text-secundario mt-1">Servicios Generales</p>
        </div>

        {step === 'email' && (
          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="text-xs text-secundario block mb-1">Correo institucional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="usuario@avante.com.sv"
                className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
              />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primario text-white rounded py-2 text-sm font-medium hover:bg-secundario disabled:opacity-50 transition-colors"
            >
              {loading ? 'Enviando...' : 'Continuar'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtp} className="space-y-4">
            <p className="text-xs text-secundario text-center">
              Ingresa el código de 6 dígitos enviado a<br />
              <span className="font-medium text-primario">{email}</span>
            </p>
            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                placeholder="000000"
                className="w-full border border-borde rounded px-3 py-2 text-sm text-center font-mono tracking-widest text-lg focus:outline-none focus:border-primario"
              />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-primario text-white rounded py-2 text-sm font-medium hover:bg-secundario disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <button
              type="button"
              onClick={() => { setCode(''); submitEmail(email).catch(() => undefined); }}
              className="w-full text-xs text-secundario hover:text-primario"
            >
              Reenviar código
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
