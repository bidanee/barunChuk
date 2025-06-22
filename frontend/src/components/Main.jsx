import React, { useState } from "react";
import './Main.css'
import PoseLandmarkerComponents from "./PoseLandmarkerComponents"

const Main = () => {
    const [isWebcamActive, setIsWebcamActive] = useState(false)
    const [captureTrigger, setCaptureTrigger] = useState(0);
    const [currentScore, setCurrentScore] = useState(null); 
    const [feedbackMsg, setFeedbackMsg] = useState('카메라를 켜고 기준 자세를 설정해주세요.');

    const handleSetReferencePose = () => {
        if(isWebcamActive === false) {
            alert("웹캠을 켜 주세요");
            return;
        }
        setCaptureTrigger(prev => prev + 1);
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
                         captureTrigger={captureTrigger}
                         />
                        <div className="main-graph"></div> 
                    </div>
                </div>
                <div className="main-feedback-container">
                    <div className="main-active-button-container">
                        {isWebcamActive === true ? <button className="main-cam-on " onClick={() => setIsWebcamActive(false)}>CAM ON</button> :<button className="main-cam-off" onClick={() => setIsWebcamActive(true)}>CAM OFF</button>}
                        {/* disabled 속성이 들어갔을때 css 수정해야함.... */ }
                        <button className='main-set-pose' onClick={handleSetReferencePose} disabled={!isWebcamActive}>기준 자세 설정</button>
                    </div>
                    <div className="main-score-container" style={{marginTop: '20px'}}>
                        <h3 className="main-score-title">현재 자세 점수</h3>
                        <p style={{fontSize: '5rem', color: '#4343c9', marginTop:0, marginBottom:'40px'}}>
                            {currentScore !== null ? currentScore : '--'}
                        </p>
                    </div>
                    <div className="feedback">{feedbackMsg}</div>
                </div>
            </div>
        </div>
    )
}

export default Main;