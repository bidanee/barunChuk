import React, { useRef, useState, useEffect, useCallback } from "react";
// react-webcam 라이브러리 대신 네이티브 비디오 요소를 사용하기 위해 제거
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
  const [postureAdvice, setPostureAdvice] = useState("AI 모델을 로드 중입니다..."); // 거북목 자세 감지 메시지
  const [isTurtleNeck, setIsTurtleNeck] = useState(false); // 거북목 자세 감지 여부
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
            // 포즈 랜드마커 모델 파일의 공개 CDN URL
            modelAssetPath:
              "/pose_landmarker_full.task",
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
      predictWebcam(); // 비디오가 재생되기 시작하고 조건이 충족될 때만 예측 루프 시작
    }
  }, [webcamRunning, modelLoading, error, predictWebcam]);


  // 불필요한 재 생성을 방지하기 위한 웹캠 예측 루프의 useCallback 훅
  const predictWebcam = useCallback(async () => {
    const video = webcamRef.current; // HTML 비디오 요소 가져오기
    const canvas = canvasRef.current; // 캔버스 요소 가져오기
    const ctx = canvas?.getContext("2d"); // 캔버스의 2D 렌더링 컨텍스트 가져오기

    // 필요한 모든 요소와 인스턴스가 사용 가능하고 준비되었는지 확인
    if (
      !video ||
      !ctx ||
      video.readyState < 2 || // 비디오 스트림이 준비되었는지 확인
      !poseLandmarkerRef.current ||
      !drawingUtilsRef.current
    ) {
      if (webcamRunning) {
        // 웹캠이 실행되어야 하지만 준비되지 않은 경우, 다음 애니메이션 프레임에서 재시도
        requestAnimationFrame(predictWebcam); // 조건이 충족되지 않아도 웹캠이 실행 중이면 계속 시도
      }
      return;
    }

    // 캔버스 치수를 비디오 피드와 일치하도록 설정
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // 캔버스에 비디오 프레임 그리기
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // 웹캠 영상을 먼저 그림

    // MediaPipe의 비디오 추론 API를 위한 현재 시간 가져오기
    const now = performance.now();

    // 비디오 프레임이 변경된 경우에만 감지 수행
    if (lastVideoTimeRef.current !== video.currentTime) {
      lastVideoTimeRef.current = video.currentTime;

      poseLandmarkerRef.current.detectForVideo(video, now, (result) => {
        // 랜드마크가 감지되면 거북목 자세 확인 로직 실행
        if (result.landmarks && result.landmarks.length > 0) {
            const currentLandmarks = result.landmarks[0]; // 현재 감지된 사람의 랜드마크 사용

            // 기준 자세 캡처 플래그가 true이면 현재 랜드마크를 저장
            if (captureReferenceFlag.current) {
                setInitialPostureLandmarks(currentLandmarks);
                setPostureAdvice("기준 자세가 설정되었습니다! 이제 자세를 분석합니다.");
                captureReferenceFlag.current = false; // 플래그 초기화
            }

            // 거북목 감지에 필요한 랜드마크 인덱스 (MediaPipe Pose 모델 기준)
            // 출처: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
            const NOSE = 0;
            const LEFT_EAR = 7;
            const RIGHT_EAR = 8;
            const LEFT_SHOULDER = 11;
            const RIGHT_SHOULDER = 12;

            let currentPostureMessage = "";
            let currentIsTurtleNeck = false;
            let drawColor = 'green'; // 기본 그리기 색상

            // 모든 필요한 랜드마크가 현재 감지되었는지 확인
            if (currentLandmarks[LEFT_EAR] && currentLandmarks[RIGHT_EAR] &&
                currentLandmarks[LEFT_SHOULDER] && currentLandmarks[RIGHT_SHOULDER] &&
                currentLandmarks[NOSE]) {

                const leftEar = currentLandmarks[LEFT_EAR];
                const rightEar = currentLandmarks[RIGHT_EAR];
                const leftShoulder = currentLandmarks[LEFT_SHOULDER];
                const rightShoulder = currentLandmarks[RIGHT_SHOULDER];
                const nose = currentLandmarks[NOSE];

                // 어깨 너비를 기준으로 동적 임계값 설정
                // 이 값을 조정하여 감지 민감도 조절 가능.
                // 기준 자세와의 X-축 편차 임계값으로 어깨 너비의 약 5%~10% 사용
                const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
                const postureThreshold = shoulderWidth * 0.07; // 7%로 조정, 필요에 따라 조절

                // 기준 자세 랜드마크가 설정되었는지 확인
                if (initialPostureLandmarks) {
                    const initialLeftEar = initialPostureLandmarks[LEFT_EAR];
                    const initialRightEar = initialPostureLandmarks[RIGHT_EAR];
                    const initialLeftShoulder = initialPostureLandmarks[LEFT_SHOULDER];
                    const initialRightShoulder = initialPostureLandmarks[RIGHT_SHOULDER];

                    // 기준 자세의 랜드마크도 유효한지 확인
                    if (initialLeftEar && initialRightEar && initialLeftShoulder && initialRightShoulder) {
                        // 기준 자세에서의 귀와 어깨 X축 상대 위치 편차
                        const initialLeftDeviation = initialLeftEar.x - initialLeftShoulder.x;
                        const initialRightDeviation = initialRightEar.x - initialRightShoulder.x;

                        // 현재 자세에서의 귀와 어깨 X축 상대 위치 편차
                        const currentLeftDeviation = leftEar.x - leftShoulder.x;
                        const currentRightDeviation = rightEar.x - rightShoulder.x;

                        // 기준 자세 대비 현재 자세의 X축 편차 변화량
                        // 이 값이 양수이면 귀가 어깨 대비 바깥쪽(화면 좌/우 끝)으로, 음수이면 안쪽으로 이동
                        const diffLeft = currentLeftDeviation - initialLeftDeviation;
                        const diffRight = currentRightDeviation - initialRightDeviation;

                        // 거북목 자세 판단 로직 (여기서는 X축 편차의 변화량을 사용)
                        // 미러링된 웹캠에서 머리가 앞으로 나올 때, 귀가 어깨에 비해 X축 상에서
                        // 더 왼쪽(x값 감소)으로 이동하거나 더 오른쪽(x값 증가)으로 이동하는 현상을 감지.
                        // 이 변화량의 절대값이 임계값을 초과하면 거북목으로 판단.
                        if (Math.abs(diffLeft) > postureThreshold || Math.abs(diffRight) > postureThreshold) {
                            currentPostureMessage = "거북목 자세가 감지됩니다! 바른 자세를 취해주세요.";
                            currentIsTurtleNeck = true;
                            drawColor = 'red';
                        } else {
                            currentPostureMessage = "좋은 자세를 유지하고 있습니다.";
                            currentIsTurtleNeck = false;
                            drawColor = 'green';
                        }
                    } else {
                        currentPostureMessage = "기준 자세의 모든 랜드마크를 감지할 수 없습니다. 다시 설정해주세요.";
                    }
                } else {
                    currentPostureMessage = "웹캠에 바른 자세를 취하고 '기준 자세 설정' 버튼을 눌러주세요.";
                }
            } else {
                currentPostureMessage = "주요 랜드마크를 감지할 수 없습니다. 더 잘 보이게 조정해주세요.";
            }
            setPostureAdvice(currentPostureMessage);
            setIsTurtleNeck(currentIsTurtleNeck);

            // 랜드마크 및 연결선 그리기
            for (const personLandmarks of result.landmarks) { // 모든 감지된 사람에 대해 그리기
                drawingUtilsRef.current.drawLandmarks(personLandmarks, {
                    radius: (landmark) => DrawingUtils.lerp(landmark.v, 0, 1, 4, 8),
                    color: drawColor, // 동적으로 변경된 색상 적용
                });
                drawingUtilsRef.current.drawConnectors(
                    personLandmarks,
                    PoseLandmarker.POSE_CONNECTIONS,
                    { color: drawColor } // 동적으로 변경된 색상 적용
                );
            }
        } else {
            // 감지된 랜드마크가 없을 경우
            setPostureAdvice("사람을 찾을 수 없습니다.");
            setIsTurtleNeck(false);
        }
      });
    }

    // 웹캠이 여전히 실행 중이면 예측 루프 계속
    if (webcamRunning) {
      requestAnimationFrame(predictWebcam);
    }
  }, [webcamRunning, initialPostureLandmarks, captureReferenceFlag]); // 의존성 추가: initialPostureLandmarks와 captureReferenceFlag

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

    // 웹캠 실행 상태 토글
    setWebcamRunning((prev) => !prev);
    // 웹캠이 꺼지면 기준 자세 초기화 및 메시지 변경
    if(webcamRunning) {
        setInitialPostureLandmarks(null);
        setPostureAdvice("웹캠 비활성화됨");
    } else {
        setPostureAdvice("웹캠 활성화됨. 기준 자세 설정 중...");
    }
  };

  // 기준 자세를 설정하는 함수
  const handleSetReferencePosture = () => {
    if (modelLoading || error || !webcamRunning) {
        setPostureAdvice("웹캠과 모델이 준비되어야 기준 자세를 설정할 수 있습니다.");
        return;
    }
    // 다음 detectForVideo 호출 시 현재 랜드마크를 캡처하도록 플래그 설정
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
        포즈 랜드마커
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
        maxWidth: '640px', // max-w-md (approx)
        backgroundColor: '#ffffff', // bg-white
        borderRadius: '12px', // rounded-xl
        boxShadow: '0 20px 25px -5px rgba(0, 0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', // shadow-2xl
        overflow: 'hidden',
        transition: 'transform 0.3s ease-in-out',
      }}>
        {/* 네이티브 비디오 요소 */}
        <video
          ref={webcamRef}
          width={videoWidth}
          height={videoHeight}
          autoPlay // 비디오 자동 재생
          playsInline // iOS에서 인라인 재생 허용
          onPlay={handleVideoOnPlay} /* 비디오가 재생될 때 예측 루프 시작 */
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%', // w-full
            height: '100%', // h-full
            objectFit: 'cover' // object-cover
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%', // w-full
            height: '100%', // h-full
            zIndex: 10 // z-10
          }}
        />
      </div>

      {/* 자세 피드백 메시지 */}
      <div style={{
        marginTop: '16px', // mt-4
        marginBottom: '8px', // mb-2
        padding: '12px', // p-3
        borderRadius: '8px', // rounded-md
        textAlign: 'center', // text-center
        fontWeight: '600', // font-semibold
        fontSize: '1.125rem', // text-lg
        transition: 'background-color 0.3s, color 0.3s',
        backgroundColor: isTurtleNeck ? '#fecaca' : '#dcfce7', // bg-red-200 or bg-green-200
        color: isTurtleNeck ? '#b91c1c' : '#16a34a' // text-red-800 or text-green-800
      }}>
        {postureAdvice}
      </div>

      {/* 제어 버튼 */}
      <button
        onClick={enableCam}
        disabled={modelLoading || error} // 로딩 중이거나 오류 발생 시 버튼 비활성화
        style={{
          marginTop: '32px', // mt-8
          padding: '16px 40px', // px-10 py-4
          borderRadius: '9999px', // rounded-full
          color: '#ffffff', // text-white
          fontWeight: '700', // font-bold
          fontSize: '1.125rem', // text-lg
          textTransform: 'uppercase', // uppercase
          letterSpacing: '0.05em', // tracking-wide
          transition: 'all 0.3s ease-in-out',
          border: 'none',
          cursor: (modelLoading || error) ? 'not-allowed' : 'pointer',
          opacity: (modelLoading || error) ? '0.6' : '1',
          backgroundColor: webcamRunning ? '#ef4444' : '#3b82f6', // 기본 빨간색/파란색
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // shadow-lg
          marginBottom: '10px' // 기준 자세 설정 버튼과의 간격
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
        disabled={!webcamRunning || modelLoading || error} // 웹캠이 실행 중이고 모델 로드가 완료되어야 활성화
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
          backgroundColor: initialPostureLandmarks ? '#6b7280' : '#10b981', // 설정되면 회색, 아니면 녹색
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
      >
        기준 자세 설정
      </button>


      <p style={{
        marginTop: '24px', // mt-6
        color: '#4b5563', // text-gray-600
        fontSize: '0.875rem', // text-sm
        lineHeight: '1.25rem', // leading-5
        textAlign: 'center', // text-center
        maxWidth: '448px' // max-w-md (approx)
      }}>

      </p>
    </div>
  );
};

export default WebcamComponent;
