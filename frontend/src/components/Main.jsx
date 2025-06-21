import React, { useState } from "react";
import './Main.css'
import PoseLandmarkerComponents from "./PoseLandmarkerComponents"
const Main = () => {
    const [isWebcamActive, setIsWebcamActive] = useState(false)
    const [captureTrigger, setCaptureTrigger] = useState(0);
    
    const [currentScore, setCurrentScore] = useState(70);
    const [feedbackMsg, setFeedbackMsg] = useState('자세를 분석 중입니다...')

    const handleSetReferencePose = () => {
        if(isWebcamActive == false) {
            alert("웹캠을 켜 주세요")
            return
        }
        // 버튼을 누를 때마다 숫자를 1씩 증가시켜서 자식 컴포넌트에 신호를 보냄
        setCaptureTrigger(prev => prev + 1);
        alert("현재 자세를 기준으로 설정을 완료했습니다!");
    };

    return (
        <div className="main-components-wrapper">
            <h1 className="main-title">자세 교정 알림 서비스</h1>  
            <div className="main-components-container">
                <div className="main-stream-graph-container">
                    <div className="main-video-container">
                        {/* 상태 업데이트 함수 전달 */}
                        <PoseLandmarkerComponents
                         isActive={isWebcamActive} 
                         onScoreUpdate={setCurrentScore}
                         onFeedbackUpdate={setFeedbackMsg}
                         captureTrigger={captureTrigger}
                         />
                        <div className="main-graph"></div> 
                    </div>
                </div>
                <div className="main-feedback-container">
                    <div className="main-active-button-container">
                        {isWebcamActive == true ? <button className="main-cam-on " onClick={() => setIsWebcamActive(false)}>CAM ON</button> :<button className="main-cam-off" onClick={() => setIsWebcamActive(true)}>CAM OFF</button>}
                        <button className='main-set-pose' onClick={handleSetReferencePose}>기준 자세 설정</button>
                    </div>
                    <div className="main-score-container" style={{marginTop: '20px'}}>
                        <h3 className="main-score-title">현재 자세 점수</h3>
                        <p style={{fontSize: '5rem', color: '#4343c9', marginTop:0, marginBottom:'40px'}}>{currentScore}</p>
                    </div>
                    <div className="feedback">{feedbackMsg}</div>
                </div>
            </div>
        </div>
    )
}

export default Main