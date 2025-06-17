// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import './App.css'; // CSS 파일 import

const App = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [poseLandmarker, setPoseLandmarker] = useState(null);
    const [isWebcamActive, setIsWebcamActive] = useState(false);
    const [lastPostureScore, setLastPostureScore] = useState(70); // 웹캠 비활성화 시 표시될 기본 점수
    const [postureFeedback, setPostureFeedback] = useState("어제 보다 바른 자세 유지 시간이 길어졌습니다 👍");
    const [currentView, setCurrentView] = useState('realtime'); // 'realtime' 또는 'video'
    // 점수 업데이트 시간 간격 제어를 위한 Ref
    const lastUpdateTimeRef = useRef(0);
    const scoreUpdateInterval = 1000; // 1초마다 점수 업데이트 (밀리초)

    // MediaPipe PoseLandmarker 초기화
    useEffect(() => {
        const initializePoseLandmarker = async () => {
            console.log("Initializing PoseLandmarker...");
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );
                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `/pose_landmarker_full.task`, // public 폴더에 있다고 가정, webpack 설정에 따라 경로 변경
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 1,
                    // 랜드마크 떨림 개선을 위한 신뢰도 임계값 조정
                    minDetectionConfidence: 0.7, // 포즈 감지 최소 신뢰도
                    minTrackingConfidence: 0.7,  // 랜드마크 추적 최소 신뢰도
                    minPresenceConfidence: 0.7   // 랜드마크 존재 최소 신뢰도
                });
                setPoseLandmarker(landmarker);
                console.log("MediaPipe PoseLandmarker 초기화 완료.");
                console.log("PoseLandmarker.POSE_CONNECTIONS:", PoseLandmarker.POSE_CONNECTIONS); // POSE_CONNECTIONS 값 확인
            } catch (error) {
                console.error("MediaPipe PoseLandmarker 초기화 실패:", error);
            }
        };
        initializePoseLandmarker();
    }, []);

    // 웹캠 활성화/비활성화 토글
    const toggleWebcam = () => {
        setIsWebcamActive(prev => !prev);
    };

    // 실시간 자세 분석 및 랜드마크 그리기
    const predictPose = async (timestamp) => {
        if (webcamRef.current && poseLandmarker && isWebcamActive) {
            const video = webcamRef.current.video;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            // videoWidth 또는 videoHeight가 0인 경우 처리를 건너뛰고 다음 프레임 대기
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                requestAnimationFrame(predictPose);
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // 비디오 스트림을 캔버스에 그리기
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // MediaPipe PoseLandmarker로 자세 분석
            const detections = poseLandmarker.detectForVideo(video, performance.now());

            if (detections.landmarks && detections.landmarks.length > 0 && Array.isArray(PoseLandmarker.POSE_CONNECTIONS)) {
                // MediaPipe의 detections.landmarks는 [[landmark1, landmark2, ...]] 형태입니다.
                // numPoses: 1이므로 detections.landmarks[0]에 실제 랜드마크 배열이 있습니다.
                const currentLandmarks = detections.landmarks[0]; // 첫 번째 사람의 랜드마크 배열

                // 랜드마크 그리기
                drawConnectors(ctx, currentLandmarks, PoseLandmarker.POSE_CONNECTIONS, {
                    color: '#00FF00', // 연두색
                    lineWidth: 4
                });
                // 중요 랜드마크와 일반 랜드마크를 다르게 그리기
                const importantLandmarkIndices = [
                    7,  // left_ear
                    8,  // right_ear
                    11, // left_shoulder
                    12, // right_shoulder
                    23, // left_hip
                    24  // right_hip
                ];

                for (let i = 0; i < currentLandmarks.length; i++) {
                    const landmark = currentLandmarks[i];
                    if (!landmark || typeof landmark.x !== 'number' || typeof landmark.y !== 'number') {
                        continue;
                    }

                    let landmarkStyle = {
                        radius: (lm) => {
                            const normalizedRadius = (lm.visibility || 0) * 5;
                            return Math.max(1, normalizedRadius);
                        },
                        fillColor: 'white', // 일반 랜드마크 흰색 채우기
                        color: 'white',     // 일반 랜드마크 흰색 테두리
                        lineWidth: 1
                    };

                    if (importantLandmarkIndices.includes(i)) {
                        // 중요 랜드마크는 더 크게, 다른 색상으로 표시
                        landmarkStyle = {
                            radius: (lm) => {
                                const normalizedRadius = (lm.visibility || 0) * 10; // 2배 크게
                                return Math.max(3, normalizedRadius);
                            },
                            fillColor: '#00BFFF', // 색상
                            color: '#00BFFF',     //테두리
                            lineWidth: 2
                        };
                    }
                    drawSingleLandmark(ctx, landmark, landmarkStyle);
                }

                // 점수 업데이트 로직: 일정 시간 간격으로만 업데이트
                if (timestamp - lastUpdateTimeRef.current > scoreUpdateInterval) {
                    const neckAngle = calculateNeckAngle(currentLandmarks); // currentLandmarks를 전달
                    if (neckAngle && neckAngle < 150) { // 예시: 거북목 기준
                        setPostureFeedback("거북목 자세입니다! 자세를 바르게 해주세요.");
                    } else {
                        setPostureFeedback("좋은 자세를 유지하고 있습니다.");
                    }
                    setLastPostureScore(Math.floor(Math.random() * 100)); // 예시 점수
                    lastUpdateTimeRef.current = timestamp; // 마지막 업데이트 시간 갱신
                }
            }
        }
        requestAnimationFrame(predictPose); // 다음 프레임 요청
    };

    // 랜드마크 연결선 그리는 함수 
const drawConnectors = (ctx, landmarks, connections, style) => {
        if (!Array.isArray(connections)) {
            console.error("drawConnectors: 'connections' is not an array.", connections);
            return;
        }
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            if (!Array.isArray(connection) || connection.length !== 2) {
                // console.warn("drawConnectors: Invalid connection element, skipping.", connection);
                continue;
            }
            const startIdx = connection[0]; // 배열 인덱스 직접 접근
            const endIdx = connection[1];   // 배열 인덱스 직접 접근
            
            // 랜드마크 인덱스가 유효한지 확인
            if (!landmarks[startIdx] || !landmarks[endIdx]) {
                continue;
            }

            const startX = landmarks[startIdx].x * ctx.canvas.width;
            const startY = landmarks[startIdx].y * ctx.canvas.height;
            const endX = landmarks[endIdx].x * ctx.canvas.width;
            const endY = landmarks[endIdx].y * ctx.canvas.height;

            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
        }
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = style.color;
        ctx.stroke();
        ctx.restore();
    };
    // 단일 랜드마크 점을 그리는 내부 헬퍼 함수
    const drawSingleLandmark = (ctx, landmark, style) => {
        ctx.beginPath();
        ctx.arc(
            landmark.x * ctx.canvas.width,
            landmark.y * ctx.canvas.height,
            style.radius(landmark),
            0,
            2 * Math.PI
        );
        ctx.fillStyle = style.fillColor;
        ctx.fill();
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = style.color;
        ctx.stroke();
    };
    // 랜드마크 점 그리는 함수 (이전 drawLandmarks에서 분리 및 개선)
    const drawLandmarks = (ctx, landmarks, style) => {
        // 이 함수는 이제 사용되지 않고 predictPose 내부에서 직접 drawSingleLandmark를 호출합니다.
        // 하지만 기존 호출 방식과의 호환성을 위해 남겨둡니다.
        if (!Array.isArray(landmarks)) {
            console.error("drawLandmarks: 'landmarks' is not an array.", landmarks);
            return;
        }
        ctx.save();
        for (let i = 0; i < landmarks.length; i++) {
            const landmark = landmarks[i];
            if (!landmark || typeof landmark.x !== 'number' || typeof landmark.y !== 'number') {
                continue;
            }
            drawSingleLandmark(ctx, landmark, style); // 기존 스타일로 그리기
        }
        ctx.restore();
    };


    // 가상의 목 각도 계산 함수 (실제 구현은 더 복잡할 수 있음)
    const calculateNeckAngle = (landmarks) => {
        if (!Array.isArray(landmarks) || landmarks.length < 13) return null; // 최소한 필요한 랜드마크 개수
        if (!landmarks[7] || !landmarks[8] || !landmarks[11] || !landmarks[12]) return null;

        const leftEar = landmarks[7];
        const rightEar = landmarks[8];
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];

        const neckCenterX = (leftEar.x + rightEar.x + leftShoulder.x + rightShoulder.x) / 4;
        const neckCenterY = (leftEar.y + rightEar.y + leftShoulder.y + rightShoulder.y) / 4;

        const vecX1 = leftShoulder.x - neckCenterX;
        const vecY1 = leftShoulder.y - neckCenterY;

        const vecX2 = leftEar.x - neckCenterX;
        const vecY2 = leftEar.y - neckCenterY;

        const dotProduct = vecX1 * vecX2 + vecY1 * vecY2;
        const magnitude1 = Math.sqrt(vecX1 * vecX1 + vecY1 * vecY1);
        const magnitude2 = Math.sqrt(vecX2 * vecX2 + vecY2 * vecY2);

        if (magnitude1 === 0 || magnitude2 === 0) return null;

        const angleRad = Math.acos(dotProduct / (magnitude1 * magnitude2));
        const angleDeg = angleRad * (180 / Math.PI);

        return angleDeg;
    };

    // 웹캠이 활성화되면 predictPose 시작
    useEffect(() => {
        if (isWebcamActive && poseLandmarker) {
            requestAnimationFrame(predictPose);
        }
    }, [isWebcamActive, poseLandmarker]);

    return (
        <div className="app-container">
            <div className="sidebar">
                <h1 className="sidebar-title">바른척</h1>
            </div>
            <div className="main-content-frame">
                <h2 className="service-title">자세 교정 서비스</h2>
                <div className="main-content-wrapper">
                    <div className="top-buttons-container">
                        <button
                            onClick={() => setCurrentView('video')}
                            className={`function-button ${currentView === 'video' ? 'active' : ''}`}
                        >
                            영상 분석
                        </button>
                        <button
                            onClick={() => setCurrentView('realtime')}
                            className={`function-button ${currentView === 'realtime' ? 'active' : ''}`}
                        >
                            실시간
                        </button>
                    </div>
                    <div className="video-score-feedback-container">
                        <div className="left-section">
                            <div className="video-correction-service-container">
                                <div className="video-content-wrapper">
                                    {currentView === 'realtime' && (
                                        <>
                                            {isWebcamActive ? (
                                                <>
                                                    <Webcam
                                                        ref={webcamRef}
                                                        mirrored={true}
                                                        className="webcam-feed"
                                                        onUserMedia={() => console.log('Webcam active')}
                                                        onUserMediaError={(error) => console.error('Webcam error:', error)}
                                                    />
                                                    <canvas
                                                        ref={canvasRef}
                                                        className="webcam-canvas"
                                                        style={{ transform: 'scaleX(-1)' }}
                                                    />
                                                </>
                                            ) : (
                                                <div className="webcam-inactive-message">웹캠이 비활성화되었습니다.</div>
                                            )}
                                        </>
                                    )}
                                    {currentView === 'video' && (
                                        <div className="video-analysis-placeholder">
                                            영상 분석 기능은 아직 준비 중입니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={toggleWebcam}
                                className="webcam-toggle-button"
                            >
                                {isWebcamActive ? '웹캠 비활성화' : '웹캠 활성화'}
                            </button>
                        </div>

                        {/* 자세, 점수 피드백 */}
                        <div className="right-section">
                            <div className="posture-score-box">
                                <h2 className="box-title">자세 점수</h2>
                                <div className="posture-score-display">
                                    <span className="posture-score-value">
                                        {isWebcamActive ? lastPostureScore : lastPostureScore}
                                    </span>
                                </div>
                            
                                <h2 className="box-title">알림 & 피드백</h2>
                                <div className="feedback-weekly-label">
                                    <span>주간</span>
                                </div>
                                <div className="weekly-graph-placeholder">
                                    (주간 자세 점수 그래프 영역 - 추후 구현)
                                </div>
                                <div className="feedback-text">
                                    {isWebcamActive ? postureFeedback : "웹캠 비활성화 상태입니다. 이전 자세 점수와 피드백이 표시됩니다."}
                                    <p className="feedback-message">{postureFeedback}</p>
                                </div>
                            </div>
                        </div>
                    </div> 
                </div> 
            </div>
        </div> 
    );
};

export default App;
