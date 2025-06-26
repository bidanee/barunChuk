import React, { useState, useEffect } from 'react';

const Stopwatch = ({ shouldRun, onResetConfirm }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setIsRunning(shouldRun);
  }, [shouldRun]);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => setTime((prev) => prev + 10), 10);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = () => {
    const seconds = `0${Math.floor((time / 1000) % 60)}`.slice(-2);
    const minutes = `0${Math.floor((time / 60000) % 60)}`.slice(-2);
    const hours = `0${Math.floor(time / 3600000)}`.slice(-2);
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <div style={{ fontSize: '3em' }}>{formatTime()}</div>
      <button onClick={onResetConfirm} style={buttonStyle}>
        Reset
      </button>
    </div>
  );
};

const buttonStyle = {
  fontSize: '1.2em',
  margin: '5px',
  padding: '10px 20px',
  cursor: 'pointer',
};

export default Stopwatch;
