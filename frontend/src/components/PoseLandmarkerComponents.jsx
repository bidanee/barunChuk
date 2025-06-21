import React, { useCallback, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import './PoseLandmarkerComponents.css'

const PoseLandmarkerComponents = ({ isActive }) => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const poseLandmarkerRef = useRef(null);
    const drawingUtilsRef = useRef(null);
    const requestRef = useRef();
    const lastResultRef = useRef(null);
    const frameCounter = useRef(0);

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

    useEffect(() => {
        if (!poseLandmarkerRef.current) {
            setupMediaPipe();
        }

        const video = webcamRef.current?.video;

        // 비디오 예측 시작 함수
        const startPrediction = () => {
            // DrawingUtils 초기화
            if (canvasRef.current) {
                drawingUtilsRef.current = new DrawingUtils(canvasRef.current.getContext('2d'));
            }
            // 예측 시작
            requestRef.current = requestAnimationFrame(predictWebcam);
        };

        if (isActive && video) {
            video.addEventListener('loadeddata', startPrediction);
        } else {
            if (video?.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
            }
        }
        return () => {
            if (video) {
                video.removeEventListener('loadeddata', startPrediction);
            }
            cancelAnimationFrame(requestRef.current);
        };
    }, [isActive, setupMediaPipe]); 

    const predictWebcam = async () => {
        if (!isActive || !webcamRef.current?.video || !poseLandmarkerRef.current) {
            return;
        }

        const video = webcamRef.current.video;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');

        if (video.videoWidth !== canvas.width || video.videoHeight !== canvas.height) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        frameCounter.current++;
        if (frameCounter.current % 2 === 0) {
            const results = await poseLandmarkerRef.current.detectForVideo(video, Date.now());
            lastResultRef.current = results;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        const lastResult = lastResultRef.current;
        if (drawingUtilsRef.current && lastResult?.landmarks?.length > 0) {
            for (const landmarks of lastResult.landmarks) {
                // drawingUtilsRef.current.drawLandmarks(landmarks, { color: '#ffffff', lineWidth: 1 });
                drawingUtilsRef.current.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#ffffff', lineWidth: 3 });
            }
        }

        requestRef.current = requestAnimationFrame(predictWebcam);
    };

    return (
        <div className='pose-container'>
            {isActive ? (
                <>
                    <Webcam
                        ref={webcamRef}
                        audio={false}
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
        </div>
    );
}

export default PoseLandmarkerComponents;
