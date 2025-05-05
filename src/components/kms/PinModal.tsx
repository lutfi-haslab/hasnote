import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';

type PinModalProps = {
  mode: 'verify' | 'create' | 'update';
  onSubmit: (pin: string, oldPin?: string) => Promise<void>;
  onCancel?: () => void;
};

const PinModal: React.FC<PinModalProps> = ({ mode, onSubmit, onCancel }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode !== 'verify' && pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    if (pin.length < 6) {
      setError('PIN must be at least 6 digits');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'update') {
        await onSubmit(pin, oldPin);
      } else {
        await onSubmit(pin);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <KeyRound size={24} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            {mode === 'verify' && 'Enter PIN'}
            {mode === 'create' && 'Create PIN'}
            {mode === 'update' && 'Update PIN'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {mode === 'verify' && 'Enter your PIN to continue'}
            {mode === 'create' && 'Create a PIN to protect your secrets'}
            {mode === 'update' && 'Update your PIN'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'update' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Current PIN
              </label>
              <Input
                type="password"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                className="mt-1"
                placeholder="Enter current PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="off"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {mode === 'verify' ? 'PIN' : 'New PIN'}
            </label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mt-1"
              placeholder="Enter PIN"
              pattern="[0-9]*"
              inputMode="numeric"
              autoComplete="off"
              disabled={loading}
            />
          </div>

          {mode !== 'verify' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Confirm PIN
              </label>
              <Input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="mt-1"
                placeholder="Confirm PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="off"
                disabled={loading}
              />
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-3 justify-end">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              className="flex items-center gap-2"
              disabled={loading}
            >
              {loading && <Spinner size="sm" />}
              <span>
                {mode === 'verify' && 'Verify'}
                {mode === 'create' && 'Create'}
                {mode === 'update' && 'Update'}
              </span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinModal;