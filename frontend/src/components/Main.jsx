import React, { useState, useCallback } from "react"; // useCallback 추가
import './Main.css';
import PoseLandmarkerComponents from "./PoseLandmarkerComponents";
import Stopwatch from "./Stopwatch";

const Main = () => {
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isReferencePoseSet, setIsReferencePoseSet] = useState(false); // 기준 자세 설정 여부 (Stopwatch 실행 조건)
  const [stopwatchKey, setStopwatchKey] = useState(0); // Stopwatch 강제 리셋용 key
  const [captureTrigger, setCaptureTrigger] = useState(0); // PoseLandmarkerComponents에 기준 자세 설정 요청 트리거
  const [currentScore, setCurrentScore] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState('카메라를 켜고 기준 자세를 설정해주세요.');
  const [resetTriggerForPose, setResetTriggerForPose] = useState(0); // PoseLandmarkerComponents 리셋 트리거

  // 콜백 함수들은 useCallback으로 감싸서 불필요한 재생성을 막습니다.
  const handleScoreUpdate = useCallback((score) => {
    setCurrentScore(score);
  }, []);

  const handleFeedbackUpdate = useCallback((feedback) => {
    setFeedbackMsg(feedback);
  }, []);

  const handleModelLoaded = useCallback((loaded) => {
    setIsModelLoaded(loaded);
  }, []);

  // PoseLandmarkerComponents로부터 기준 자세 설정 결과(성공/실패)를 받을 콜백
  const handleReferencePoseSetStatus = useCallback((isSet) => {
    setIsReferencePoseSet(isSet);
  }, []);

  // '기준 자세 설정' 버튼 클릭 핸들러
  const handleSetReferencePose = useCallback(() => {
    if (!isWebcamActive) {
      alert("웹캠을 켜 주세요");
      return;
    }
    // 새로운 기준 자세 설정을 시도할 때는 스톱워치를 잠시 멈춥니다.
    // 설정이 완료되면 PoseLandmarkerComponents의 onReferencePoseSet 콜백을 통해 다시 시작될 수 있습니다.
    setIsReferencePoseSet(false);
    setCaptureTrigger(prev => prev + 1); // PoseLandmarkerComponents에 기준 자세 설정 요청
  }, [isWebcamActive]); // isWebcamActive 의존성 추가

  // 'Reset' 버튼 클릭 핸들러
  const handleReset = useCallback(() => {
    const confirmed = window.confirm("정말 초기화하시겠습니까?");
    if (confirmed) {
      setIsWebcamActive(false); // 웹캠 비활성화 (선택 사항, 필요하다면)
      setIsModelLoaded(false); // 모델 로딩 상태 초기화
      setIsReferencePoseSet(false); // 기준 자세 해제 (Stopwatch 멈춤)
      setCurrentScore(null); // 점수 초기화
      setFeedbackMsg("카메라를 켜고 기준 자세를 설정해주세요."); // 피드백 메시지 초기화
      setStopwatchKey(prev => prev + 1); // 스톱워치 초기화 (강제 리마운트)
      setResetTriggerForPose(prev => prev + 1); // PoseLandmarkerComponents 내부 상태 초기화 요청
    }
  }, []); // 의존성 없음 (내부에서 상태만 변경)


  return (
    <div className="main-components-wrapper">
      <h1 className="main-title">자세 교정 알림 서비스</h1>
      <div className="main-components-container">
        <div className="main-stream-graph-container">
          <div className="main-video-container">
            <PoseLandmarkerComponents
              isActive={isWebcamActive}
              onScoreUpdate={handleScoreUpdate} // useCallback으로 감싼 함수 전달
              onFeedbackUpdate={handleFeedbackUpdate} // useCallback으로 감싼 함수 전달
              onModelLoaded={handleModelLoaded} // useCallback으로 감싼 함수 전달
              captureTrigger={captureTrigger}
              onReferencePoseSet={handleReferencePoseSetStatus} // useCallback으로 감싼 함수 전달
              onResetFromMain={resetTriggerForPose} // 리셋 신호 전달
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
              // 스톱워치 실행 조건: 웹캠 활성화, 모델 로드 완료, 기준 자세 설정 완료
              shouldRun={isWebcamActive && isModelLoaded && isReferencePoseSet}
              onResetConfirm={handleReset}
              key={stopwatchKey} // key 변경 시 Stopwatch 컴포넌트 강제 리마운트(초기화)
            />
        </div>
      </div>
    </div>
  );
};

export default Main;