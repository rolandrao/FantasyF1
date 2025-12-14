// src/components/DraftConfirmationModal.jsx

const DraftConfirmationModal = ({
  item, // { name, type }
  onConfirm,
  onCancel,
  isMyTurn
}) => {
  // --- FIX: Check if item is valid and if it's the user's turn ---
  if (!item || !isMyTurn) return null;
  // --- END FIX ---
    
  const isDriver = item.type === 'driver'
  const accentColor = isDriver ? 'border-f1-red' : 'border-blue-500'
  const buttonClass = isDriver ? 'bg-f1-red hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onCancel}>
      <div 
        className="bg-neutral-800 w-full max-w-sm rounded-xl border-t-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" 
        onClick={e => e.stopPropagation()}
        style={{ borderColor: isDriver ? '#ff1e00' : '#3b82f6' }}
      >
        
        {/* Header */}
        <div className={`p-4 ${isDriver ? 'bg-f1-red/10' : 'bg-blue-900/10'} border-b border-neutral-700 text-center`}>
          <div className="text-3xl mb-2">{isDriver ? '🏎️' : '🔧'}</div>
          <h2 className="text-xl font-black italic">Confirm Draft Pick</h2>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-gray-300 mb-4">
            Are you sure you want to draft:
          </p>
          <div className="text-2xl font-black text-white p-3 rounded-lg border border-neutral-600">
            {item.name}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            This will use Pick #{item.pickNumber}.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 bg-neutral-900 border-t border-neutral-700">
          <button 
            onClick={onCancel} 
            className="flex-1 py-3 text-sm font-bold rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className={`flex-1 py-3 text-sm font-black rounded-lg text-white transition ${buttonClass}`}
          >
            Confirm Pick
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftConfirmationModal;