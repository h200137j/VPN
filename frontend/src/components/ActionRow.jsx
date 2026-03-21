export default function ActionRow({ status, activeProfileId, onConnect, onDisconnect, appendLog, disconnecting }) {
  const isActive = status === 'connected' || status === 'connecting' || status === 'reconnecting';

  const handleConnect = () => {
    if (!activeProfileId) { appendLog('Select a profile first.', 'warn'); return; }
    onConnect();
  };

  if (disconnecting) {
    return (
      <div className="action-row">
        <button className="btn-disconnect btn-disconnecting" disabled>
          <span className="btn-connect-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7 }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/>
              <path d="M12 6v6l4 2-1 1.73-5-2.73V6z"/>
            </svg>
            Disconnecting...
          </span>
        </button>
      </div>
    );
  }

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
