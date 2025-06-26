import React, { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import './PoseLandmarkerComponents.css';
import { calculateAdvancedMetrics, PoseSmoother, analyzePoseV2, validateReferencePose } from "../utils/calculatePostureScore";
import AlertModal from "./AlertModal"
import posemodel from "../models/pose_landmarker_full.task"

const PoseLandmarkerComponents = ({ isActive, onScoreUpdate, onFeedbackUpdate, captureTrigger,onModelLoaded }) => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const poseLandmarkerRef = useRef(null);
    const drawingUtilsRef = useRef(null);
    const requestRef = useRef();
    const smoothRef = useRef(new PoseSmoother(15));
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const referencePoseRef = useRef(null);
    const [isAlertModalOpen, setAlertModalOpen] = useState(false);
    const badPostureTimerRef = useRef(null);
    const BAD_POSTURE_THRESHOLD = 50;
    const ALERT_DELAY = 5000;
    const [referenceFailMessage, setReferenceFailMessage] = useState(null);
    const [referenceSuccessMessage, setReferenceSuccessMessage] = useState(null);


    // MediaPipe 모델 설정
    const setupMediaPipe = useCallback(async () => {
        if (poseLandmarkerRef.current || isLoading) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm");
            poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: posemodel,
                    delegate: 'GPU'
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.4,
                minPosePresenceConfidence: 0.4,
                minTrackingConfidence: 0.4
            });
            console.log('[성공] 모델 로딩 완료');
        } catch (error) {
            console.error('[오류] 모델 로딩 실패:', error);
            setLoadError("AI 모델 로딩에 실패했습니다. ");
        } finally {
            setIsLoading(false);
        }
    }, [isLoading]);

    const predictWebcam = useCallback(() => {
        if (isLoading || !isActive || !poseLandmarkerRef.current || !webcamRef.current?.video || !canvasRef.current) {
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

        const results = poseLandmarkerRef.current.detectForVideo(video, Date.now());
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            const rawMetrics = calculateAdvancedMetrics(landmarks);
            
            if (rawMetrics) {
                smoothRef.current.addMetrics(rawMetrics);
                const smoothedMetrics = smoothRef.current.getSmoothedMetrics();
                
                if (referencePoseRef.current && smoothedMetrics) {
                    const { score, feedback } = analyzePoseV2(smoothedMetrics, referencePoseRef.current);
                    
                    onScoreUpdate(score);
                    onFeedbackUpdate(feedback);

                    // 나쁜 자세 알림
                    if (score < BAD_POSTURE_THRESHOLD) {
                        if (!badPostureTimerRef.current) {
                            badPostureTimerRef.current = setTimeout(() => { setAlertModalOpen(true); }, ALERT_DELAY);
                        }
                    } else {
                        clearTimeout(badPostureTimerRef.current);
                        badPostureTimerRef.current = null;
                    }
                } else {
                    onScoreUpdate(null); 
                    onFeedbackUpdate("웹캠을 보고 바른 자세를 취한 후, '기준 자세 설정' 버튼을 눌러주세요.");
                }
            }
            context.save();
            context.scale(-1, 1);
            context.translate(-canvas.width, 0);
            drawingUtilsRef.current.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#ffffff', lineWidth: 4 });
            drawingUtilsRef.current.drawLandmarks(landmarks, { color: '#ffffff', radius: 5 });
            context.restore();
        } else {
             if (!referencePoseRef.current) {
                onScoreUpdate(null);
                onFeedbackUpdate("카메라에 상반신이 잘 보이도록 앉아주세요.");
             }            
        }
        
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [isActive, isLoading, onScoreUpdate, onFeedbackUpdate]);
    useEffect(() => {
        if (isActive) {
            console.log("CAM ON: MediaPipe 설정 시작");
            setupMediaPipe();
        } else {
            console.log("CAM OFF");
            poseLandmarkerRef.current?.close();
            poseLandmarkerRef.current = null;
            drawingUtilsRef.current = null;
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
        }
    }, [isActive, setupMediaPipe]);

    useEffect(() => {
        if (isActive && !isLoading && poseLandmarkerRef.current) {
            requestRef.current = requestAnimationFrame(predictWebcam);
        }
        return () => {
            cancelAnimationFrame(requestRef.current);
        }
    }, [isActive, isLoading, predictWebcam]);

    useEffect(() => {
        if (captureTrigger > 0) {
            const smoothedMetrics = smoothRef.current.getSmoothedMetrics();
            if (smoothedMetrics) {
                const result = validateReferencePose(smoothedMetrics);
                if (result.isValid) {
                    referencePoseRef.current = smoothedMetrics;
                    onFeedbackUpdate(result.message);
                    setReferenceFailMessage(null); // 실패 메시지 초기화
                    setReferenceSuccessMessage(result.message); // ✅ 성공 메시지 설정
                } else {
                    onFeedbackUpdate(result.message); // 텍스트 피드백도 주고
                    setReferenceFailMessage(result.message); // ❗ 모달용 메시지 저장
                }
            } else {
                const fallbackMsg = "기준 자세 설정 실패: AI가 아직 자세를 충분히 인식하지 못했어요.";
                onFeedbackUpdate(fallbackMsg);
                setReferenceFailMessage(fallbackMsg); // 이 경우도 모달 열기 가능
            }
        }
    }, [captureTrigger, onFeedbackUpdate]);


    useEffect(() => {
  if (isLoading === false && poseLandmarkerRef.current) {
    onModelLoaded(true); // ✅ Main에 모델 로딩 완료 알림
  }
}, [isLoading]);

    return (
        <div className='pose-container'>
            {loadError && <div className="pose-webcam-off"><p style={{color: 'red'}}>{loadError}</p></div>}
            {isLoading && <div className="pose-webcam-off"><p>AI 모델을 불러오는 중입니다...</p></div>}
            {!isLoading && !isActive && <div className="pose-webcam-off"><p>카메라가 꺼져 있습니다.</p></div>}
            
            {isActive && (
                <div style={{ visibility: isLoading || loadError ? 'hidden' : 'visible' }}>
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        mirrored={true}
                        videoConstraints={{ width: 500, height: 350, facingMode: 'user' }}
                    />
                    <canvas ref={canvasRef} />
                </div>
            )}
            {isAlertModalOpen && (
                <AlertModal
                    title="자세가 흐트러졌어요!"
                    message="스트레칭 한번 하고 다시 바른 자세를 유지해 주세요."
                    onClose={() => setAlertModalOpen(false)}
                />
            )}
            {referenceFailMessage && (
                <AlertModal
                    title="기준 자세 설정 실패"
                    message={referenceFailMessage}  // ✅ 문자열 메시지
                    onClose={() => setReferenceFailMessage(null)} // ✅ 닫기 시 메시지 초기화
                />
            )}
            {referenceSuccessMessage && (
                <AlertModal
                    title="기준 자세 설정 완료"
                    message={referenceSuccessMessage}
                    onClose={() => setReferenceSuccessMessage(null)}
                />
            )}
        </div>
    );
}

export default PoseLandmarkerComponents