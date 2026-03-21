export default function ActionRow({ status, activeProfileId, onConnect, onDisconnect, appendLog }) {
  const isActive = status === 'connected' || status === 'connecting' || status === 'reconnecting';

  const handleConnect = () => {
    if (!activeProfileId) { appendLog('Select a profile first.', 'warn'); return; }
    onConnect();
  };

  return (
    <div className="action-row">
      {!isActive ? (
        <button className="btn-connect" onClick={handleConnect} disabled={!activeProfileId}>
          <span className="btn-connect-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.9 }}>
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1z"/>
            </svg>
            Connect
          </span>
        </button>
      ) : (
        <button className="btn-disconnect" onClick={onDisconnect}>
          <span className="btn-connect-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.9 }}>
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
            {status === 'connecting' || status === 'reconnecting' ? 'Cancel' : 'Disconnect'}
          </span>
        </button>
      )}
    </div>
  );
}
