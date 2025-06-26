import React, { useState } from "react";
import './Main.css';
import PoseLandmarkerComponents from "./PoseLandmarkerComponents";
import Stopwatch from "./Stopwatch";

const Main = () => {
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isReferencePoseSet, setIsReferencePoseSet] = useState(false);
  const [stopwatchKey, setStopwatchKey] = useState(0);
  const [captureTrigger, setCaptureTrigger] = useState(0);
  const [currentScore, setCurrentScore] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState('카메라를 켜고 기준 자세를 설정해주세요.');

  const handleSetReferencePose = () => {
    if (!isWebcamActive) {
      alert("웹캠을 켜 주세요");
      return;
    }
    setCaptureTrigger(prev => prev + 1);
    setIsReferencePoseSet(true); // 기준 자세 설정됨
  };

  const handleReset = () => {
    const confirmed = window.confirm("정말 초기화하시겠습니까?");
    if (confirmed) {
      setIsReferencePoseSet(false);
      setCurrentScore(null);
      setFeedbackMsg("카메라를 켜고 기준 자세를 설정해주세요.");
      setStopwatchKey(prev => prev + 1); // 스톱워치 리셋
    }
  };

  return (
    <div className="main-components-wrapper">
      <h1 className="main-title">자세 교정 알림 서비스</h1>
      <div className="main-components-container">
        <div className="main-stream-graph-container">
          <div className="main-video-container">
            <PoseLandmarkerComponents
              isActive={isWebcamActive}
              onScoreUpdate={setCurrentScore}
              onFeedbackUpdate={setFeedbackMsg}
              onModelLoaded={setIsModelLoaded}
              captureTrigger={captureTrigger}
            />
            <div className="main-feedback">
              <div className="feedback">
                {feedbackMsg.split(/[.!?]/).map((line, idx) =>
                  line.trim() && <div key={idx}> {line.trim()}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="main-feedback-container">
          <div className="main-active-button-container">
            {isWebcamActive ? (
                <button className="main-cam-on" onClick={() => setIsWebcamActive(false)}>CAM ON</button>
            ) : (
                <button className="main-cam-off" onClick={() => setIsWebcamActive(true)}>CAM OFF</button>
            )}
            <button className='main-set-pose' onClick={handleSetReferencePose} disabled={!isWebcamActive}>
              기준 자세 설정
            </button>
          </div>

          <div className="main-score-container">
            <h3 className="main-score-title">현재 자세 점수</h3>
            <p className="main-score">
              {currentScore !== null ? currentScore : '--'}
            </p>
          </div>
            <Stopwatch
              shouldRun={isWebcamActive && isModelLoaded && isReferencePoseSet}
              onResetConfirm={handleReset}
              key={stopwatchKey}
            />
        </div>
      </div>
    </div>
  );
};

export default Main;
