import React, { useState } from "react";
import './Main.css'
import Webcam from "react-webcam";
import PoseLandmarker from "./PoseLandmarkerComponents"
import PoseLandmarkerComponents from "./PoseLandmarkerComponents"
const Main = () => {
    const [isWebcamActive, setIsWebcamActive] = useState(true)
    const [pose,setPose] = useState(false)
    return (
        <div className="main-components-wrapper">

            <h1 className="main-title">자세 교정 알림 서비스</h1>  
            <div className="main-components-container">
                <div className="main-stream-graph-container">
                    <div className="main-video-container">
                        <PoseLandmarkerComponents isActive={isWebcamActive}/>
                        {/* <Webcam/>
                        <div className="main-webcam"> </div>
                        <canvas/> */}
                        {/* <div className="main-graph"></div>  */}
                    </div>
                </div>
                <div className="main-feedback-container">
                    <div className="main-active-button-container">
                        {isWebcamActive == true ? <button className="main-cam-on " onClick={() => setIsWebcamActive(false)}>CAM ON</button> :<button className="main-cam-off" onClick={() => setIsWebcamActive(true)}>CAM OFF</button>}
                        <button className={`main-set-pose ${pose == true ? 'poseset-active' : ''}`} onClick={() => setPose(!pose)}>기준 자세 설정</button>
                    </div>
                    <div className="main-score-container">
                        <h3 className="main-score-title">오늘 자세 최고 점수</h3>
                        <div className="main-score">70</div>
                    </div>
                    <div className="feedback">이것은 피드백일까나</div>
                    <div onClick={() => {window.open('http://56.155.62.180:3000')}}>가주라</div>
                </div>
            </div>
        </div>
    )
}

export default Main