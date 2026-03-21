import React from 'react';

export default function Header({ status }) {
  const labels = {
    connecting: 'Connecting...', connected: 'Connected',
    disconnected: 'Disconnected', reconnecting: 'Reconnecting...'
  };
  const pillState = status === 'reconnecting' ? 'connecting' : status;

  return (
    <div className="header">
      <div className="logo-area">
        <div className={`shield ${pillState}`}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z" fill="currentColor"/>
          </svg>
        </div>
        <div>
          <h1>GoVPN</h1>
          <span className="subtitle">Secure OpenVPN Client</span>
        </div>
      </div>
      <div className="header-right">
        <div className={`status-pill ${pillState}`}>
          <div className={`dot ${status}`}></div>
          <span>{labels[status] || status}</span>
        </div>
      </div>
    </div>
  );
}
