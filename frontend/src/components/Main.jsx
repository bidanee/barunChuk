import React, { useState, useCallback } from "react"; // useCallback 추가
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
  const [resetTriggerForPose, setResetTriggerForPose] = useState(0); 

  const handleScoreUpdate = useCallback((score) => {
    setCurrentScore(score);
  }, []);

  const handleFeedbackUpdate = useCallback((feedback) => {
    setFeedbackMsg(feedback);
  }, []);

  const handleModelLoaded = useCallback((loaded) => {
    setIsModelLoaded(loaded);
  }, []);

  const handleReferencePoseSetStatus = useCallback((isSet) => {
    setIsReferencePoseSet(isSet);
  }, []);

  const handleSetReferencePose = useCallback(() => {
    if (!isWebcamActive) {
      alert("웹캠을 켜 주세요");
      return;
    }
    setIsReferencePoseSet(false);
    setCaptureTrigger(prev => prev + 1);
  }, [isWebcamActive]); 


  const handleReset = useCallback(() => {
    const confirmed = window.confirm("정말 초기화하시겠습니까?");
    if (confirmed) {
      setIsWebcamActive(false); // 웹캠 비활성화 
      setIsModelLoaded(false); // 모델 로딩 상태 초기화
      setIsReferencePoseSet(false); // 기준 자세 해제 
      setCurrentScore(null); // 점수 초기화
      setFeedbackMsg("카메라를 켜고 기준 자세를 설정해주세요."); // 피드백 메시지 초기화
      setStopwatchKey(prev => prev + 1); // 스톱워치 초기화 
      setResetTriggerForPose(prev => prev + 1); // PoseLandmarkerComponents 내부 상태 초기화 요청
    }
  }, []); 


  return (
    <div className="main-components-wrapper">
      <h1 className="main-title">자세 교정 알림 서비스</h1>
      <div className="main-components-container">
        <div className="main-stream-graph-container">
          <div className="main-video-container">
            <PoseLandmarkerComponents
              isActive={isWebcamActive}
              onScoreUpdate={handleScoreUpdate} 
              onFeedbackUpdate={handleFeedbackUpdate} 
              onModelLoaded={handleModelLoaded} 
              captureTrigger={captureTrigger}
              onReferencePoseSet={handleReferencePoseSetStatus} 
              onResetFromMain={resetTriggerForPose} 
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