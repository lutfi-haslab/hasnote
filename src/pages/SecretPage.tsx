import PinModal from '@/components/kms/PinModal';
import SecretsList from '@/components/kms/SecretsList';
import Button from '@/components/ui/Button';
import { useKMSStore } from '@/store/kmsStore';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';

const SecretPage = () => {
  const { hasPin, updatePin } = useKMSStore();
  const [showUpdatePinModal, setShowUpdatePinModal] = useState(false);

  const handleUpdatePin = async (newPin: string, oldPin: string) => {
    await updatePin(oldPin, newPin);
    setShowUpdatePinModal(false);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Security</h2>
          {hasPin && (
            <Button
              variant="outline"
              onClick={() => setShowUpdatePinModal(true)}
              className="flex items-center gap-2"
            >
              <KeyRound size={16} />
              Update PIN
            </Button>
          )}
        </div>
      </div>

      <div className="p-6">
        <SecretsList />
      </div>
      {showUpdatePinModal && (
        <PinModal
          mode="update"
          onSubmit={handleUpdatePin}
          onCancel={() => setShowUpdatePinModal(false)}
        />
      )}
    </div>
  );
};

export default SecretPage;
