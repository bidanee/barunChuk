import React, { useCallback, useEffect, useRef,useState } from "react";
import Webcam from "react-webcam";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import './PoseLandmarkerComponents.css'
import { analyzePose } from "../utils/calculatePostureScore"

const PoseLandmarkerComponents = ({ isActive, onScoreUpdate, onFeedbackUpdate, captureTrigger }) => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const poseLandmarkerRef = useRef(null);
    const drawingUtilsRef = useRef(null);
    const requestRef = useRef();

    //알림 기능 관련
    const [isAlertModalOpen, setAlertModalOpen] = useState(false)
    const badPostureTimerRef = useRef(null);
    const BAD_POSTURE_THRESHOLD = 50
    const ALERT_DELAY = 10000

    // 기준 자세 관련
    const referencePoseRef = useRef(null); 
    const lastAnalysisResultRef = useRef(null);

    // 이동 평균 ref : 점수가 확확 변하지 않게...
    const scoresHistoryRef = useRef([])
    const MOVING_AVERAGE_WINDOW = 10; // 최근 15개 점수 평균, 여기 조절시 점수 변함 속도 줄일 수 잇음

    // 피드백 안정성 관련 Ref 및 상수 추가
    const displayedFeedbackRef = useRef("자세를 분석 중입니다...");
    const feedbackCandidateRef = useRef(null);
    const feedbackTimerRef = useRef(null);
    const FEEDBACK_STABILITY_DELAY = 10; // 민감도 조절   

    
    useEffect(() => {
        if (captureTrigger > 0) {
            referencePoseRef.current = lastAnalysisResultRef.current;
            console.log("새로운 기준 자세가 설정되었습니다:", referencePoseRef.current);
            clearTimeout(feedbackTimerRef.current);
            feedbackCandidateRef.current = null;
        }
    }, [captureTrigger]); 

    // MediaPipe 모델 로드
    const setupMediaPipe = useCallback(async () => {
        try {
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
            poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "/models/pose_landmarker_full.task",
                    delegate: 'GPU'
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPosePresenceConfidence: 0.5, 
                minTrackingConfidence: 0.5
            });
            console.log('Pose LandMarker 모델을 성공적으로 불러왔습니다.');
        } catch (error) {
            console.error('Pose LandMarker 초기화 실패 : ', error);
        }
    }, []);

    const predictWebcam = useCallback(async () => {
            if (!poseLandmarkerRef.current || !webcamRef.current?.video) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }
        
        const video = webcamRef.current.video;
        if (video.readyState < 2) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }

        if (!drawingUtilsRef.current) {
            drawingUtilsRef.current = new DrawingUtils(canvasRef.current.getContext('2d'));
        }
        
        const results = await poseLandmarkerRef.current.detectForVideo(video, Date.now());
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.clearRect(0, 0, canvas.width, canvas.height);

        // 랜드마크 좌표 가져오기 
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];

            // --- 1. 분석 (원본 좌표 기준) ---
            const leftShoulder = landmarks[11];
            const rightShoulder = landmarks[12];
            const leftEar = landmarks[7];
            const rightEar = landmarks[8];

            if (leftShoulder && rightShoulder && leftEar && rightEar) {
                const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
                const shoulderMidPointX = (leftShoulder.x + rightShoulder.x) / 2;
                const earAvgX = (leftEar.x + rightEar.x) / 2;
                const headForwardOffset = shoulderMidPointX - earAvgX;
                const normalizedHeadForwardOffset = headForwardOffset / shoulderWidth;
                const shoulderTiltAngle = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * 180 / Math.PI;

                lastAnalysisResultRef.current = { offset: normalizedHeadForwardOffset, tilt: shoulderTiltAngle };
                
                // analyzePose는 score와 feedback 두 개만 반환
                const { score, feedback } = analyzePose(lastAnalysisResultRef.current, referencePoseRef.current);

                // --- 2. 점수 부드럽게 만들기 (이동 평균) ---
                scoresHistoryRef.current.push(score);
                if (scoresHistoryRef.current.length > MOVING_AVERAGE_WINDOW) {
                    scoresHistoryRef.current.shift();
                }
                const sum = scoresHistoryRef.current.reduce((acc, curr) => acc + curr, 0);
                const averagedScore = Math.round(sum / scoresHistoryRef.current.length) || 0;
                onScoreUpdate(averagedScore);

                // --- 3. 피드백 안정화 로직 ---
                if (feedback === displayedFeedbackRef.current) {
                    clearTimeout(feedbackTimerRef.current);
                    feedbackCandidateRef.current = null;
                } else if (feedback !== feedbackCandidateRef.current) {
                    clearTimeout(feedbackTimerRef.current);
                    feedbackCandidateRef.current = feedback;
                    feedbackTimerRef.current = setTimeout(() => {
                        onFeedbackUpdate(feedback);
                        displayedFeedbackRef.current = feedback;
                        feedbackCandidateRef.current = null;
                    }, FEEDBACK_STABILITY_DELAY);
                }
                
                // --- 4. 나쁜 자세 알림 ---
                if (score < BAD_POSTURE_THRESHOLD) {
                    if (!badPostureTimerRef.current) {
                        badPostureTimerRef.current = setTimeout(() => {
                            setAlertModalOpen(true);
                            // const audio = new Audio('/ting.mp3');
                            // audio.play();
                        }, ALERT_DELAY);
                    }
                } else {
                    if (badPostureTimerRef.current) clearTimeout(badPostureTimerRef.current);
                }
            }
            
            // --- 5. 그리기 (분석이 끝난 후, 반전된 캔버스에) ---
            context.save();
            context.scale(-1, 1);
            context.translate(-canvas.width, 0);
            drawingUtilsRef.current.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#ffffff', lineWidth: 3 });
            drawingUtilsRef.current.drawLandmarks(landmarks, { color: '#ffffff', radius: 2 });
            context.restore();
        }
        
        if (isActive) {
            requestRef.current = requestAnimationFrame(predictWebcam);
        }
    }, [isActive, onScoreUpdate, onFeedbackUpdate]);


    useEffect(() => {
        setupMediaPipe();
    }, [setupMediaPipe]);

    useEffect(() => {
        if (isActive) {
            // 카메라가 켜지면 애니메이션 루프 시작
            requestRef.current = requestAnimationFrame(predictWebcam);
        } else {
            // 카메라가 꺼지면 애니메이션 루프 중단
            cancelAnimationFrame(requestRef.current);
        }
        // 컴포넌트가 사라지거나, isActive나 predictWebcam 함수가 바뀔 때 루프를 정리합니다.
        return () => cancelAnimationFrame(requestRef.current);
    }, [isActive, predictWebcam]); 

    return (
        <div className='pose-container'>
            {isActive ? (
                <>
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        mirrored={true}
                        videoConstraints={{ width: 500, height: 350,facingMode: 'user' }}
                    />
                    <canvas
                        ref={canvasRef}
                    />
                </>
            ) : (
                <div className="pose-webcam-off">
                    <p>카메라가 꺼져 있습니다.</p>
                </div>
            )}
        {isAlertModalOpen && (
            <div className="alert-modal">
                <div className="modal-content">
                    <h3>자세가 흐트러졌어요!</h3>
                    <p>스트레칭 한번 하고 다시 바른 자세를 유지해 주세요.</p>
                    <button onClick={() => setAlertModalOpen(false)}>확인</button>
                </div>
            </div>
        )}
        </div>
    );
}

export default PoseLandmarkerComponents;
