import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// 포즈 감지를 위한 주요 웹캠 컴포넌트
const WebcamComponent = () => {
  // DOM 요소 및 MediaPipe 인스턴스에 접근하기 위한 ref들
  const webcamRef = useRef(null); // HTML 비디오 요소를 위한 ref
  const canvasRef = useRef(null); // HTML 캔버스 요소를 위한 ref

  // UI 및 애플리케이션 로직을 위한 상태 변수
  const [webcamRunning, setWebcamRunning] = useState(false); // 예측 활성화 여부 제어
  const [modelLoading, setModelLoading] = useState(true); // MediaPipe 모델 로딩 중인지 여부 표시
  const [error, setError] = useState(null); // 모델 로딩 또는 웹캠 접근 중 발생한 오류 저장
  const [postureAdvice, setPostureAdvice] = useState("AI 모델을 로드 중입니다..."); // 자세 감지 메시지
  const [isBadPosture, setIsBadPosture] = useState(false); // 나쁜 자세 감지 여부
  const [initialPostureLandmarks, setInitialPostureLandmarks] = useState(null); // 기준 자세 랜드마크 저장
  const captureReferenceFlag = useRef(false); // 기준 자세 캡처를 위한 플래그

  // 렌더링을 다시 유발하지 않고 렌더링 전반에 걸쳐 유지되어야 하는 MediaPipe 객체들을 위한 ref들
  const poseLandmarkerRef = useRef(null); // PoseLandmarker 인스턴스 보유
  const drawingUtilsRef = useRef(null); // 캔버스 작업을 위한 DrawingUtils 인스턴스 보유
  const lastVideoTimeRef = useRef(-1); // 마지막으로 처리된 비디오 프레임 타임스탬프 추적
  const runningModeRef = useRef("VIDEO"); // MediaPipe 감지 모드 지정 (웹캠의 경우 항상 VIDEO)

  // 비디오 및 캔버스 치수를 위한 상수
  const videoWidth = 640;
  const videoHeight = 480;

  // ===== 자세 교정 관련 상수 및 임계값 설정 =====
  // 이 값들은 사용 환경과 개인에게 맞춰 조절해야 합니다.
  // 픽셀 또는 비디오 높이/너비 대비 비율로 설정됩니다.

  // 거북목 감지 임계값 (귀-어깨 Y축 상대 거리 변화)
  // 기준 자세 대비 귀가 어깨보다 일정 픽셀 이상 앞으로 나갔을 때 (Y축 값이 낮아짐)
  const TURTLE_NECK_Y_THRESHOLD_RATIO = 0.04; // 비디오 높이의 4% (예: 480 * 0.04 = 약 19px)
  // 귀-어깨 X축 상대 거리 변화 (추가적인 거북목 판단 보조)
  const TURTLE_NECK_X_THRESHOLD_RATIO = 0.05; // 비디오 너비의 5% (예: 640 * 0.05 = 약 32px)

  // 구부정한 등 (어깨 처짐) 감지 임계값 (어깨 Y축 절대 위치 변화)
  // 기준 자세 대비 어깨가 일정 픽셀 이상 아래로 처졌을 때 (Y축 값이 높아짐)
  const SLOUCHING_SHOULDER_Y_THRESHOLD_RATIO = 0.05; // 비디오 높이의 5% (예: 480 * 0.05 = 약 24px)
  // ===========================================

  // 컴포넌트가 마운트될 때 Pose Landmarker 모델을 로드하기 위한 useEffect 훅
  useEffect(() => {
    const createLandmarker = async () => {
      try {
        setModelLoading(true); // 로딩 상태를 true로 설정
        setError(null); // 이전 오류 초기화
        setPostureAdvice("AI 모델을 로드 중입니다...");

        // MediaPipe 작업을 위한 WASM 모듈을 가져오기 위해 FilesetResolver 초기화
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );

        // 지정된 옵션으로 PoseLandmarker 인스턴스 생성
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            // 포즈 랜드마커 모델 파일의 공개 CDN URL (정적 파일을 제공하는 경로에 있어야 함)
            modelAssetPath: "/pose_landmarker_full.task",
          },
          runningMode: runningModeRef.current, // 실행 모드를 VIDEO로 설정
          numPoses: 1, // 최대 1개의 포즈 감지
        });

        poseLandmarkerRef.current = landmarker; // 랜드마커 인스턴스를 ref에 저장

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          // 캔버스 렌더링 컨텍스트로 DrawingUtils 초기화
          drawingUtilsRef.current = new DrawingUtils(ctx);
        }
        setModelLoading(false); // 모델 로드 완료 후 로딩 상태를 false로 설정
        setPostureAdvice("웹캠을 활성화하고 자세를 설정해주세요.");
      } catch (err) {
        console.error("MediaPipe 모델 로딩 오류:", err);
        setError("포즈 감지 모델을 로드하지 못했습니다. 다시 시도해 주세요.");
        setModelLoading(false); // 오류 발생 시 로딩 상태를 false로 설정
        setPostureAdvice("오류 발생: 모델 로드 실패");
      }
    };

    createLandmarker(); // 랜드마커를 생성하는 비동기 함수 호출

    // 정리 함수: 컴포넌트가 언마운트될 때 랜드마커 닫기
    return () => {
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []); // 빈 의존성 배열은 이 효과가 마운트 시 한 번만 실행되도록 보장합니다.

  // 웹캠 스트림을 시작하고 중지하기 위한 useEffect 훅
  useEffect(() => {
    let stream = null; // 스트림을 null로 초기화

    const startStream = async () => {
      if (!webcamRunning) {
        // 웹캠이 꺼져 있으면 스트림 중지
        if (webcamRef.current && webcamRef.current.srcObject) {
          webcamRef.current.srcObject.getTracks().forEach(track => track.stop());
          webcamRef.current.srcObject = null;
        }
        setPostureAdvice("웹캠 비활성화됨");
        return; // 실행 중이 아니면 종료
      }

      if (modelLoading || error) {
        // 모델 로드 중이거나 오류가 있으면 웹캠 시작 불가
        setPostureAdvice("모델 로드 중이거나 오류가 있습니다. 웹캠을 시작할 수 없습니다.");
        return;
      }

      try {
        // 스트림을 이미 가져오지 않았거나 이전에 중지된 경우에만 미디어 스트림 요청
        if (!webcamRef.current || !webcamRef.current.srcObject) {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: videoWidth },
                    height: { ideal: videoHeight },
                    facingMode: "user",
                },
            });
            if (webcamRef.current) {
                webcamRef.current.srcObject = stream;
            }
        }
        setPostureAdvice("웹캠 활성화됨. 기준 자세 설정 중...");
      } catch (err) {
        console.error("웹캠 접근 오류:", err);
        setError("웹캠에 접근할 수 없습니다. 카메라 권한을 확인하세요.");
        setWebcamRunning(false); // 오류 발생 시 웹캠 실행 중지
        setPostureAdvice("오류 발생: 웹캠 접근 실패");
      }
    };

    startStream();

    // 정리: 컴포넌트 언마운트 시 또는 webcamRunning 변경 시 스트림 중지
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webcamRunning, modelLoading, error]);

  // 비디오 'onplay' 이벤트를 처리하는 함수
  const handleVideoOnPlay = useCallback(() => {
    if (webcamRunning && !modelLoading && !error) {
      requestAnimationFrame(predictWebcam);
    }
  }, [webcamRunning, modelLoading, error]);

  // 웹캠 예측 루프 (자세 감지 및 분석의 핵심)
  const predictWebcam = useCallback(async () => {
    const video = webcamRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (
      !video ||
      !ctx ||
      video.readyState < 2 ||
      !poseLandmarkerRef.current ||
      !drawingUtilsRef.current
    ) {
      if (webcamRunning) {
        requestAnimationFrame(predictWebcam);
      }
      return;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const now = performance.now();

    if (lastVideoTimeRef.current !== video.currentTime) {
      lastVideoTimeRef.current = video.currentTime;

      poseLandmarkerRef.current.detectForVideo(video, now, (result) => {
        if (result.landmarks && result.landmarks.length > 0) {
            const currentLandmarks = result.landmarks[0];

            if (captureReferenceFlag.current) {
                setInitialPostureLandmarks(currentLandmarks);
                setPostureAdvice("기준 자세가 설정되었습니다! 이제 자세를 분석합니다.");
                captureReferenceFlag.current = false;
            }

            // MediaPipe Pose 랜드마크 인덱스 (주요 랜드마크)
            const NOSE = 0;
            const LEFT_EAR = 7;
            const RIGHT_EAR = 8;
            const LEFT_SHOULDER = 11;
            const RIGHT_SHOULDER = 12;
            const LEFT_HIP = 23;
            const RIGHT_HIP = 24;

            let currentPostureMessage = "";
            let currentIsBadPosture = false;
            let drawColor = 'green'; // 기본 그리기 색상

            // 모든 필수 랜드마크가 감지되었는지 확인
            if (currentLandmarks[LEFT_EAR] && currentLandmarks[RIGHT_EAR] &&
                currentLandmarks[LEFT_SHOULDER] && currentLandmarks[RIGHT_SHOULDER] &&
                currentLandmarks[NOSE] &&
                currentLandmarks[LEFT_HIP] && currentLandmarks[RIGHT_HIP]) {

                const leftEar = currentLandmarks[LEFT_EAR];
                const rightEar = currentLandmarks[RIGHT_EAR];
                const leftShoulder = currentLandmarks[LEFT_SHOULDER];
                const rightShoulder = currentLandmarks[RIGHT_SHOULDER];
                const nose = currentLandmarks[NOSE];
                const leftHip = currentLandmarks[LEFT_HIP];
                const rightHip = currentLandmarks[RIGHT_HIP];


                if (initialPostureLandmarks) {
                    const initialLeftEar = initialPostureLandmarks[LEFT_EAR];
                    const initialRightEar = initialPostureLandmarks[RIGHT_EAR];
                    const initialLeftShoulder = initialPostureLandmarks[LEFT_SHOULDER];
                    const initialRightShoulder = initialPostureLandmarks[RIGHT_SHOULDER];
                    const initialLeftHip = initialPostureLandmarks[LEFT_HIP];
                    const initialRightHip = initialPostureLandmarks[RIGHT_HIP];

                    if (initialLeftEar && initialRightEar && initialLeftShoulder && initialRightShoulder && initialLeftHip && initialRightHip) {

                        // =========================================================
                        // 1. 거북목 감지 로직 (귀-어깨 Y축, X축 상대 위치 변화 복합 사용)
                        // =========================================================
                        const initialAvgEarY = (initialLeftEar.y + initialRightEar.y) / 2;
                        const initialAvgShoulderY = (initialLeftShoulder.y + initialRightShoulder.y) / 2;
                        const initialEarShoulderDiffY = initialAvgEarY - initialAvgShoulderY; // 기준: 귀-어깨 Y차이

                        const currentAvgEarY = (leftEar.y + rightEar.y) / 2;
                        const currentAvgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
                        const currentEarShoulderDiffY = currentAvgEarY - currentAvgShoulderY;

                        // Y축 변화: 귀가 어깨 대비 더 아래로 내려왔을 때 (즉, 머리가 앞으로 숙여졌을 때)
                        // 양수 값 => 귀가 어깨보다 Y값이 커짐 (아래로 내려감) = 머리가 앞으로 숙여짐
                        const diffEarShoulderY = currentEarShoulderDiffY - initialEarShoulderDiffY;

                        // X축 변화: 귀가 어깨 대비 X축 상에서 더 앞으로 나갔을 때
                        // (미러링 웹캠 환경에서는 X값이 왼쪽/오른쪽으로 더 멀어지는 경향)
                        const initialAvgEarX = (initialLeftEar.x + initialRightEar.x) / 2;
                        const initialAvgShoulderX = (initialLeftShoulder.x + initialRightShoulder.x) / 2;
                        const initialEarShoulderDiffX = initialAvgEarX - initialAvgShoulderX;

                        const currentAvgEarX = (leftEar.x + rightEar.x) / 2;
                        const currentAvgShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
                        const currentEarShoulderDiffX = currentAvgEarX - currentAvgShoulderX;

                        // 양수 또는 음수 => 기준 대비 X축 방향으로 변화
                        const diffEarShoulderX = currentEarShoulderDiffX - initialEarShoulderDiffX;


                        let isTurtleNeckDetected = false;
                        if (diffEarShoulderY > (videoHeight * TURTLE_NECK_Y_THRESHOLD_RATIO) ||
                            Math.abs(diffEarShoulderX) > (videoWidth * TURTLE_NECK_X_THRESHOLD_RATIO)) {
                            // Y축으로 숙여지거나 (주요 판단), X축으로 과도하게 앞으로 나갔을 때 (보조 판단)
                            isTurtleNeckDetected = true;
                        }

                        // =========================================================
                        // 2. 구부정한 등 감지 로직 (어깨 Y축 변화)
                        // =========================================================
                        const initialAvgShoulderYAbs = (initialLeftShoulder.y + initialRightShoulder.y) / 2;
                        const currentAvgShoulderYAbs = (leftShoulder.y + rightShoulder.y) / 2;

                        // 어깨가 기준 자세 대비 아래로 처졌을 때 (Y축 값이 커짐)
                        const diffShoulderYAbs = currentAvgShoulderYAbs - initialAvgShoulderYAbs;

                        let isSlouchingDetected = false;
                        if (diffShoulderYAbs > (videoHeight * SLOUCHING_SHOULDER_Y_THRESHOLD_RATIO)) {
                            isSlouchingDetected = true;
                        }

                        // =========================================================
                        // 종합적인 자세 판단 및 피드백
                        // =========================================================
                        if (isTurtleNeckDetected && isSlouchingDetected) {
                            currentPostureMessage = "거북목과 등이 구부정합니다! 바른 자세를 취해주세요.";
                            currentIsBadPosture = true;
                            drawColor = 'red';
                        } else if (isTurtleNeckDetected) {
                            currentPostureMessage = "거북목 자세가 감지됩니다! 고개를 뒤로 당겨주세요.";
                            currentIsBadPosture = true;
                            drawColor = 'orange'; // 거북목만 감지 시 주황색
                        } else if (isSlouchingDetected) {
                            currentPostureMessage = "등이 구부정합니다! 어깨를 펴고 앉아주세요.";
                            currentIsBadPosture = true;
                            drawColor = 'orange'; // 구부정한 등만 감지 시 주황색
                        } else {
                            currentPostureMessage = "좋은 자세를 유지하고 있습니다. 계속 유지해주세요!";
                            currentIsBadPosture = false;
                            drawColor = 'green';
                        }

                    } else {
                        currentPostureMessage = "기준 자세의 모든 랜드마크를 감지할 수 없습니다. 다시 설정해주세요.";
                    }
                } else {
                    currentPostureMessage = "웹캠에 바른 자세를 취하고 '기준 자세 설정' 버튼을 눌러주세요.";
                }
            } else {
                currentPostureMessage = "주요 랜드마크를 감지할 수 없습니다. 몸 전체가 잘 보이게 조정해주세요.";
            }
            setPostureAdvice(currentPostureMessage);
            setIsBadPosture(currentIsBadPosture); // 상태 변수 이름 변경

            // 랜드마크 및 연결선 그리기
            for (const personLandmarks of result.landmarks) {
                drawingUtilsRef.current.drawLandmarks(personLandmarks, {
                    radius: (landmark) => DrawingUtils.lerp(landmark.v, 0, 1, 4, 8),
                    color: drawColor,
                });
                drawingUtilsRef.current.drawConnectors(
                    personLandmarks,
                    PoseLandmarker.POSE_CONNECTIONS,
                    { color: drawColor }
                );
            }
        } else {
            setPostureAdvice("사람을 찾을 수 없습니다.");
            setIsBadPosture(false);
        }
      });
    }

    if (webcamRunning) {
      requestAnimationFrame(predictWebcam);
    }
  }, [webcamRunning, initialPostureLandmarks, captureReferenceFlag,
      videoHeight, videoWidth, // 임계값 계산에 사용되므로 의존성에 추가
      TURTLE_NECK_Y_THRESHOLD_RATIO, TURTLE_NECK_X_THRESHOLD_RATIO, SLOUCHING_SHOULDER_Y_THRESHOLD_RATIO // 임계값 상수도 의존성에 추가
    ]);

  // 웹캠 예측을 켜고 끄는 함수
  const enableCam = () => {
    if (modelLoading) {
      console.log("⏳ 모델이 아직 로드 중입니다. 잠시 기다려 주세요.");
      return;
    }
    if (error) {
      console.log("❌ 모델 로딩 중 오류가 발생했습니다.");
      return;
    }

    setWebcamRunning((prev) => !prev);
    if(webcamRunning) { // 웹캠이 꺼질 때
        setInitialPostureLandmarks(null);
        setPostureAdvice("웹캠 비활성화됨");
        setIsBadPosture(false); // 나쁜 자세 상태 초기화
    } else { // 웹캠이 켜질 때
        setPostureAdvice("웹캠 활성화됨. 기준 자세 설정 중...");
    }
  };

  // 기준 자세를 설정하는 함수
  const handleSetReferencePosture = () => {
    if (modelLoading || error || !webcamRunning) {
        setPostureAdvice("웹캠과 모델이 준비되어야 기준 자세를 설정할 수 있습니다.");
        return;
    }
    captureReferenceFlag.current = true;
    setPostureAdvice("기준 자세를 캡처 중...");
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px',
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'Inter, sans-serif',
      MozOsxFontSmoothing: 'grayscale',
      WebkitFontSmoothing: 'antialiased'
    }}>
      <h1 style={{
        fontSize: '2.25rem', // text-4xl
        lineHeight: '2.5rem', // leading-10
        fontWeight: '800', // font-extrabold
        marginBottom: '1.5rem', // mb-6
        color: '#1f2937', // text-gray-800
        textAlign: 'center',
        letterSpacing: 'tight'
      }}>
        앉은 자세 교정 서비스
      </h1>

      {/* 로딩 및 오류 메시지 */}
      {modelLoading && (
        <div style={{
          color: '#2563eb', // text-blue-600
          fontSize: '1.125rem', // text-lg
          lineHeight: '1.75rem', // leading-7
          marginBottom: '1rem', // mb-4
          padding: '12px', // p-3
          borderRadius: '8px', // rounded-md
          backgroundColor: '#dbeafe', // bg-blue-100
          border: '1px solid #bfdbfe' // border border-blue-200
        }}>
          AI 모델 로드 중... 잠시 기다려 주세요.
        </div>
      )}
      {error && (
        <div style={{
          color: '#dc2626', // text-red-600
          fontSize: '1.125rem', // text-lg
          lineHeight: '1.75rem', // leading-7
          marginBottom: '1rem', // mb-4
          padding: '12px', // p-3
          borderRadius: '8px', // rounded-md
          backgroundColor: '#fee2e2', // bg-red-100
          border: '1px solid #fecaca' // border border-red-200
        }}>
          오류: {error}
        </div>
      )}

      {/* 웹캠 및 캔버스 컨테이너 */}
      <div style={{
        position: 'relative',
        width: videoWidth,
        height: videoHeight,
        maxWidth: '640px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        transition: 'transform 0.3s ease-in-out',
      }}>
        <video
          ref={webcamRef}
          width={videoWidth}
          height={videoHeight}
          autoPlay
          playsInline
          onPlay={handleVideoOnPlay}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 10
          }}
        />
      </div>

      {/* 자세 피드백 메시지 */}
      <div style={{
        marginTop: '16px',
        marginBottom: '8px',
        padding: '12px',
        borderRadius: '8px',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: '1.125rem',
        transition: 'background-color 0.3s, color 0.3s',
        backgroundColor: isBadPosture ? '#fecaca' : '#dcfce7', // 나쁜 자세면 빨간색, 좋으면 초록색
        color: isBadPosture ? '#b91c1c' : '#16a34a'
      }}>
        {postureAdvice}
      </div>

      {/* 제어 버튼 */}
      <button
        onClick={enableCam}
        disabled={modelLoading || error}
        style={{
          marginTop: '32px',
          padding: '16px 40px',
          borderRadius: '9999px',
          color: '#ffffff',
          fontWeight: '700',
          fontSize: '1.125rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'all 0.3s ease-in-out',
          border: 'none',
          cursor: (modelLoading || error) ? 'not-allowed' : 'pointer',
          opacity: (modelLoading || error) ? '0.6' : '1',
          backgroundColor: webcamRunning ? '#ef4444' : '#3b82f6',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          marginBottom: '10px'
        }}
      >
        {modelLoading
          ? "모델 로드 중..."
          : webcamRunning
          ? "예측 비활성화"
          : "예측 활성화"}
      </button>

      {/* 기준 자세 설정 버튼 */}
      <button
        onClick={handleSetReferencePosture}
        disabled={!webcamRunning || modelLoading || error}
        style={{
          padding: '12px 24px',
          borderRadius: '9999px',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'all 0.3s ease-in-out',
          border: 'none',
          cursor: (!webcamRunning || modelLoading || error) ? 'not-allowed' : 'pointer',
          opacity: (!webcamRunning || modelLoading || error) ? '0.6' : '1',
          backgroundColor: initialPostureLandmarks ? '#6b7280' : '#10b981',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
      >
        기준 자세 설정
      </button>

      <p style={{
        marginTop: '24px',
        color: '#4b5563',
        fontSize: '0.875rem',
        lineHeight: '1.25rem',
        textAlign: 'center',
        maxWidth: '448px'
      }}>
        카메라가 활성화되어 있는지 확인하세요. 이 애플리케이션은 MediaPipe Pose Landmarker를 사용하여 실시간으로 앉은 자세를 감지하고 교정 피드백을 제공합니다. 바른 자세를 취한 후 '기준 자세 설정' 버튼을 눌러주세요.
      </p>
    </div>
  );
};

export default WebcamComponent;