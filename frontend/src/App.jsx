import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {io} from 'socket.io-client'
import './App.css'; 

const App = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [poseLandmarker, setPoseLandmarker] = useState(null);
    const [isWebcamActive, setIsWebcamActive] = useState(false);
    const [lastPostureScore, setLastPostureScore] = useState(0); // 웹캠 비활성화 시 표시될 기본 점수
    const [postureFeedback, setPostureFeedback] = useState("어제 보다 바른 자세 유지 시간이 길어졌습니다 👍");
    const [currentView, setCurrentView] = useState('realtime'); 

    // const fixedExternalPageUrl = 'https://56.155.62.180:3000';
    const fixedExternalPageUrl = 'https://eunbie.site';
    
    //기준 자세 설정 관련
    // 기준 자세 설정 관련 상태 및 Ref
    const [referencePoseLandmarks, setReferencePoseLandmarks] = useState(null); // 기준 자세 랜드마크 저장
    const referencePoseLandmarksRef = useRef(null); // 기준 자세 랜드마크의 최신 값을 predictPose에 전달하기 위한 Ref
    const latestLandmarksRef = useRef(null); // predictPose에서 감지된 최신 랜드마크 임시 저장
    const [referenceSetMessage, setReferenceSetMessage] = useState(''); // 기준 자세 설정 메시지
    
    const lastFrameSendTimeRef = useRef(0);
    const frameSendInterval = 1000; // 100ms마다 프레임 전송 (초당 10프레임)

    const socketRef = useRef(null); // socket.io 인스턴스를 저장할 Ref

    // MediaPipe PoseLandmarker 초기화
    useEffect(() => {
        const initializePoseLandmarker = async () => {
            console.log("랜드마크 초기화 중");
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );
                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `/pose_landmarker_full.task`, // public 폴더에 있으면 이런식
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 1,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5, 
                    minPresenceConfidence: 0.5  
                });
                setPoseLandmarker(landmarker);
                console.log("MediaPipe PoseLandmarker 초기화 완료.");
                // 초기화 시점 값 확인
                // console.log("PoseLandmarker.POSE_CONNECTIONS (on init):", PoseLandmarker.POSE_CONNECTIONS); 
                if (!PoseLandmarker.POSE_CONNECTIONS || PoseLandmarker.POSE_CONNECTIONS.length === 0) {
                    console.error("POSE_CONNECTIONS is empty or invalid after init!");
                }
            } catch (error) {
                console.error("MediaPipe PoseLandmarker 초기화 실패:", error);
            }
        };
        initializePoseLandmarker();
    }, []);

    // Socket.io 연결 설정 및 해제
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const wsHost = 'barunchuk.5team.store';
        const wsPath = '/socket.io'; 
        const wsPort = '443'
        const socketUrl = `${protocol}//${wsHost}:${wsPort}`; 
        console.log("Attempting WebSocket connection to:", socketUrl);

        if (socketRef.current && socketRef.current.connected) { 
            socketRef.current.disconnect(); 
        }
        socketRef.current = io(socketUrl, {
            path: wsPath,
            transports: ['websocket'], 
            forceNew: true
        });

        socketRef.current.on('connect', () => {
            console.log('Socket.IO connected to Node.js server!');
        });

        socketRef.current.on('connection_test', (message) => {
            console.log('Server test message:', message);
        });

        socketRef.current.on('analysis_result', (data) => {
            try {
                console.log('Received analysis result:', data);
                if (data.posture_score !== undefined) {
                    setLastPostureScore(data.posture_score);
                    setPostureFeedback(data.feedback || "자세 분석 피드백.");
                }
            } catch (e) {
                console.error("Failed to parse Socket.IO message:", e, data);
            }
        });

        socketRef.current.on('analysis_error', (error) => {
            console.error('Socket.IO analysis error:', error);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Socket.IO disconnected');
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
        });
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []); 

    // 웹캠 활성화/비활성화 토글
    const toggleWebcam = () => {
        setIsWebcamActive(prev => {
            // console.log("웹캠 활성화 확인", !prev); 
            return !prev;
        });
    };
    // '실시간' & '영상 분석' 뷰 변경 핸들러
    const handleViewChange = (view) => {
        setCurrentView(view);
        if (view === 'realtime') {
            if (!isWebcamActive) { 
                setIsWebcamActive(true);
            }
        } else { 
            if (isWebcamActive) {
                setIsWebcamActive(false);
            }
        }
    };
    // 기준 자세 설정 함수
    const setReferencePose = () => {
        if (!isWebcamActive || !latestLandmarksRef.current || latestLandmarksRef.current.length === 0) {
            setReferenceSetMessage('웹캠이 활성화되어 있고 자세가 감지된 상태에서 설정해주세요!');
            // 메시지 3초 후 사라지도록
            setTimeout(() => setReferenceSetMessage(''), 3000);
            return;
        }
        // 상태와 Ref 모두 업데이트
        setReferencePoseLandmarks(latestLandmarksRef.current);
        referencePoseLandmarksRef.current = latestLandmarksRef.current; // Ref에도 저장
        setReferenceSetMessage('기준 자세가 설정되었습니다!');
        console.log('Reference pose set:', latestLandmarksRef.current);
        setTimeout(() => setReferenceSetMessage(''), 3000);
    };


    // 실시간 자세 분석 및 랜드마크 그리는 코드
    const predictPose = async (timestamp) => {
        if (webcamRef.current && poseLandmarker && isWebcamActive && currentView === 'realtime') { 
            const video = webcamRef.current.video;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (video.videoWidth === 0 || video.videoHeight === 0) {
                requestAnimationFrame(predictPose);
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // 비디오 스트림을 캔버스에 그리기
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // MediaPipe PoseLandmarker로 랜드마크 감지
            const detections = poseLandmarker.detectForVideo(video, performance.now());

            if (detections.landmarks && detections.landmarks.length > 0 && Array.isArray(PoseLandmarker.POSE_CONNECTIONS)) {
                const currentLandmarks = detections.landmarks[0]; 
                latestLandmarksRef.current = currentLandmarks; // 최신 랜드마크 Ref에 저장

                // 랜드마크 그리기
                drawConnectors(ctx, currentLandmarks, PoseLandmarker.POSE_CONNECTIONS, {
                    color: '#00FF00', // 연두색
                    lineWidth: 4
                });
                // 중요 랜드마크와 일반 랜드마크를 다르게 그리기
                const importantLandmarkIndices = [
                    0, // nose
                    7,  // left_ear
                    8,  // right_ear
                    11, // left_shoulder
                    12, // right_shoulder
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
                        fillColor: 'white', 
                        color: 'white',     
                        lineWidth: 1
                    };

                    if (importantLandmarkIndices.includes(i)) {
                        landmarkStyle = {
                            radius: (lm) => {
                                const normalizedRadius = (lm.visibility || 0) * 10; 
                                return Math.max(3, normalizedRadius);
                            },
                            fillColor: '#00BFFF', // 색상
                            color: '#00BFFF',     //테두리
                            lineWidth: 2
                        };
                    }
                    drawSingleLandmark(ctx, landmark, landmarkStyle);
                }
            } else {
                latestLandmarksRef.current = null; // 랜드마크 감지 안 되면 Ref 초기화
            }

            // 웹캠 프레임을 Node.js 서버로 전송 (일정 간격으로)
            if (socketRef.current && socketRef.current.connected && isWebcamActive &&
                timestamp - lastFrameSendTimeRef.current > frameSendInterval) {

                const imageData = canvas.toDataURL('image/jpeg', 0.8); // JPEG, 품질 0.5

                // Socket.IO로 보낼 데이터 객체 (기준 자세 랜드마크 포함)
                const dataToSend = {
                    imageData: imageData,
                    referencePoseData: referencePoseLandmarksRef.current // Ref의 현재 값 사용
                };
                socketRef.current.emit('image_frame', dataToSend); // 데이터 객체 전송
                lastFrameSendTimeRef.current = timestamp;
            } else if (socketRef.current && !socketRef.current.connected) {
                // console.log("Socket.IO not connected, skipping frame send.");
            } else if (!isWebcamActive) {
                // console.log("Webcam not active, skipping frame send.");
            }
        }else if (currentView === 'video') { 
            // iframe으로 외부 페이지를 보여주므로 predictPose에서 웹캠 스트림을 처리하지 않음
        }
        requestAnimationFrame(predictPose); // 다음 프레임 요청
    };

    // 랜드마크 연결선 그리는 함수 
    const drawConnectors = (ctx, landmarks, connections, style) => {
        // // --- 디버깅용: drawConnectors 함수 진입 로그 ---
        // console.log("drawConnectors function entered. Connections length:", connections?.length); 
        // console.log("drawConnectors received connections (full):", connections); 

        if (!Array.isArray(connections)) {
            console.error("drawConnectors: 'connections' is not an array.", connections);
            return;
        }
        if (connections.length === 0) {
            // console.warn("drawConnectors: 'connections' array is empty, no lines will be drawn.");
            return;
        }

        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];

            let startIdx, endIdx;
            if (typeof connection === 'object' && connection !== null && 
                       typeof connection.start === 'number' && typeof connection.end === 'number') {
                startIdx = connection.start; 
                endIdx = connection.end;     
            } else if (Array.isArray(connection) && connection.length === 2) { // 배열 형태일 때 (대비)
                startIdx = connection[0]; 
                endIdx = connection[1];
            } else {
                console.warn("drawConnectors: Invalid connection element, skipping.", connection); 
                continue; 
            }
            
            if (!landmarks[startIdx] || !landmarks[endIdx]) {
                continue;
            }

            if ((landmarks[startIdx].visibility || 0) < 0.5 || (landmarks[endIdx].visibility || 0) < 0.5) {
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
                            onClick={() => handleViewChange('video')}
                            className={`function-button ${currentView === 'video' ? 'active' : ''}`}
                        >
                            영상 분석
                        </button>
                        <button
                            onClick={() => handleViewChange('realtime')}
                            className={`function-button ${currentView === 'realtime' ? 'active' : ''}`}
                        >
                            실시간
                        </button>
                    </div>
                    {currentView == 'realtime' && (
                        <div className='video-score-feedback-container'>
                            <div className="left-section">
                                <div className="video-correction-service-container">
                                    <div className="video-content-wrapper">
                                        {isWebcamActive? (
                                            <>
                                            <Webcam ref={webcamRef} mirrored={true} className='webcam-feed' onUserMedia={() => console.log('Webcam Active')} onUserMediaError={(error)=> console.error('Webcam error: ',error)}/>
                                            <canvas ref={canvasRef} className='webcam-canvas' style={{transform:'scaleX(-1)'}}/>
                                            </>
                                        ) : (
                                            <div className='webcam-inactive-message'>웹캠이 비활성화되었습니다.</div>
                                        )}
                                    </div>
                                </div>
                                <div className="webcam-control-buttons">
                                    <button onClick={toggleWebcam} className="webcam-toggle-button">
                                        {isWebcamActive ? '웹캠 비활성화' : '웹캠  활성화'}
                                    </button>
                                    <button onClick={setReferencePose} className="reference-pose-button">
                                        기준 자세 설정
                                    </button>
                                </div>
                                {referenceSetMessage && (
                                <p className="reference-set-message">{referenceSetMessage}</p>
                                )}
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
                                        {isWebcamActive ? "웹캠 활성화 상태입니다." : "웹캠 비활성화 상태입니다. 이전 자세 점수와 피드백이 표시됩니다."}
                                        <p className="feedback-message">{postureFeedback}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {currentView === 'video' && (
                        // 영상 분석 모드일 때 iframe 렌더링 (고정된 URL 사용)
                        <iframe
                            id="external-page-iframe"
                            src={fixedExternalPageUrl} // 고정된 URL 사용
                            title="External Analysis Page"
                            className="external-page-iframe"
                            allow="camera; microphone; fullscreen;" // 필요한 권한 허용 (사이트에 따라)
                        >
                            <p>이 브라우저는 iframe을 지원하지 않습니다.</p>
                        </iframe>
                    )}
                </div> 
            </div>
        </div> 
    );
};

export default App;
