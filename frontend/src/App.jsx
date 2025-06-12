import React, { useRef, useState } from 'react';
import WebcamComponent from './components/webCam'

function App() {
  const videoRef = useRef(null);
  const [feedback, setFeedback] = useState('');

  const captureAndSend = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg');

    try {
      const response = await fetch('http://localhost:3000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });
      const result = await response.json();
      setFeedback(result.feedback);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
    <h1>uplopad test입니다</h1>
      <video ref={videoRef} autoPlay playsInline />
      <button onClick={captureAndSend}>자세 분석</button>
      <WebcamComponent/>
      <div>{feedback}</div>
    </div>
  );
}

export default App;
