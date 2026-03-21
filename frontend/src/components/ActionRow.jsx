import React from 'react';

export default function ActionRow({ status, activeProfileId, onConnect, onDisconnect, appendLog }) {
  const isActive = status === 'connected' || status === 'connecting' || status === 'reconnecting';

  const handleConnect = () => {
    if (!activeProfileId) { appendLog('Select a profile first.', 'warn'); return; }
    onConnect();
  };

  return (
    <div className="action-row">
      {!isActive && (
        <button className="btn-connect" onClick={handleConnect}>
          Connect
        </button>
      )}
      {isActive && (
        <button className="btn-disconnect" onClick={onDisconnect}>
          Disconnect
        </button>
      )}
    </div>
  );
}
