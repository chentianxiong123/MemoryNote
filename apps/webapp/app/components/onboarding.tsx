export function Onboarding({ onComplete }: { onComplete?: () => void }) {
  return (
    <div className="p-4">
      <h2>Welcome to MemoryNote</h2>
      <button onClick={onComplete}>Get Started</button>
    </div>
  );
}

export function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-background p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Welcome to MemoryNote</h2>
        <p className="mb-4">Get started with your memory assistant.</p>
        <button
          onClick={() => {
            onComplete?.();
            onClose();
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
