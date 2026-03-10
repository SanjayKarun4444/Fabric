import React from 'react';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">🤖</div>
        <h2>AI Agent Suite</h2>
        <div className="loading-spinner"></div>
        <p>Initializing agents...</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
