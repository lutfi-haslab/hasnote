import React, { useEffect, useState } from 'react';
import { useKMSStore } from '../../store/kmsStore';
import { Eye, EyeOff, Trash2, Plus, KeyRound } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';
import PinModal from './PinModal';

const SecretsList: React.FC = () => {
  const {
    secrets,
    loading,
    error,
    fetchSecrets,
    addSecret,
    getSecret,
    deleteSecret,
    verifyPin,
    createPin,
    checkHasPin,
    hasPin,
  } = useKMSStore();

  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<string, string>
  >({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', value: '' });
  const [pinModal, setPinModal] = useState<null | 'create' | 'verify'>(null);
  const [pendingAction, setPendingAction] = useState<{
    action: (pin: string) => Promise<void>;
    secretId?: string;
  } | null>(null);

  useEffect(() => {
    checkHasPin();
    fetchSecrets();
  }, []);

  const handleAddSecret = async (pin: string) => {
    try {
      await addSecret(form.name, form.value, pin);
      setShowAddForm(false);
      setForm({ name: '', value: '' });
    } catch (err) {
      console.error('Failed to add secret:', err);
    }
  };

  const handleRevealSecret = async (secretId: string, pin: string) => {
    try {
      const value = await getSecret(secretId, pin);
      setRevealedSecrets((prev) => ({ ...prev, [secretId]: value }));
    } catch (err) {
      console.error('Failed to reveal secret:', err);
      throw err;
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (!pendingAction) return;

    try {
      if (pinModal === 'verify') {
        const isValid = await verifyPin(pin);
        if (!isValid) throw new Error('Invalid PIN');
      } else if (pinModal === 'create') {
        await createPin(pin);
      }

      await pendingAction.action(pin);
    } finally {
      setPinModal(null);
      setPendingAction(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this secret?')) {
      await deleteSecret(id);
    }
  };

  const startActionWithPin = (
    action: (pin: string) => Promise<void>,
    secretId?: string
  ) => {
    setPendingAction({ action, secretId });
    setPinModal(hasPin ? 'verify' : 'create');
  };

  const toggleSecretVisibility = (secretId: string) => {
    if (revealedSecrets[secretId]) {
      setRevealedSecrets((prev) => {
        const { [secretId]: _, ...rest } = prev;
        return rest;
      });
    } else {
      startActionWithPin((pin) => handleRevealSecret(secretId, pin), secretId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <KeyRound className="text-blue-600" /> Encrypted Secrets
        </h2>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus size={16} /> Add Secret
        </Button>
      </div>

      {error && <div className="text-red-600">{error}</div>}
      {loading && !secrets.length && <Spinner size="lg" />}

      {showAddForm && (
        <div className="border p-4 rounded bg-slate-50">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Secret name"
          />
          <Input
            label="Value"
            type="password"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            placeholder="Secret value"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setShowAddForm(false)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!form.name || !form.value}
              onClick={() => startActionWithPin(handleAddSecret)}
            >
              Save Secret
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {secrets.map((secret) => {
          const isRevealed = !!revealedSecrets[secret.id];
          return (
            <div
              key={secret.id}
              className="p-3 border rounded flex justify-between items-start"
            >
              <div className="min-w-0">
                <div className="font-semibold truncate">{secret.name}</div>
                <div className="font-mono text-sm text-slate-600 mt-1 truncate">
                  {isRevealed
                    ? revealedSecrets[secret.id]
                    : '••••••••••••••••••'}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  onClick={() => toggleSecretVisibility(secret.id)}
                  variant="outline"
                  size="sm"
                  aria-label={isRevealed ? 'Hide secret' : 'Reveal secret'}
                >
                  {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>

                <Button
                  onClick={() => handleDelete(secret.id)}
                  variant="outline"
                  size="sm"
                  aria-label="Delete secret"
                >
                  <Trash2 size={16} className="text-red-600" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {pinModal && (
        <PinModal
          mode={pinModal}
          onSubmit={handlePinSubmit}
          onCancel={() => {
            setPinModal(null);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
};

export default SecretsList;
