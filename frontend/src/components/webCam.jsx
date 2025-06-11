import React, { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const WebcamComponent = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const poseLandmarkerRef = useRef(null);
  const drawingUtilsRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const runningModeRef = useRef("IMAGE");

  const videoWidth = 640;
  const videoHeight = 480;

  useEffect(() => {
    const createLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/pose_landmarker_full.task", // public 폴더에 있으므로 절대경로
      },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      poseLandmarkerRef.current = landmarker;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        drawingUtilsRef.current = new DrawingUtils(ctx);
      }
    };

    createLandmarker();
  }, []);

  const enableCam = () => {
    if (!poseLandmarkerRef.current) {
      console.log("⏳ 모델이 아직 로딩되지 않았어요!");
      return;
    }

    setWebcamRunning((prev) => !prev);
  };

  const predictWebcam = useCallback(async () => {
    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!video || !ctx || video.readyState < 2) {
      requestAnimationFrame(predictWebcam);
      return;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    if (runningModeRef.current === "IMAGE") {
      runningModeRef.current = "VIDEO";
      await poseLandmarkerRef.current.setOptions({ runningMode: "VIDEO" });
    }

    const now = performance.now();

    if (lastVideoTimeRef.current !== video.currentTime) {
      lastVideoTimeRef.current = video.currentTime;

      poseLandmarkerRef.current.detectForVideo(video, now, (result) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const landmarks of result.landmarks) {
          drawingUtilsRef.current.drawLandmarks(landmarks, { radius: 4 });
          drawingUtilsRef.current.drawConnectors(
            landmarks,
            PoseLandmarker.POSE_CONNECTIONS
          );
        }
      });
    }

    if (webcamRunning) {
      requestAnimationFrame(predictWebcam);
    }
  }, [webcamRunning]);

  useEffect(() => {
    if (webcamRunning) {
      requestAnimationFrame(predictWebcam);
    }
  }, [webcamRunning, predictWebcam]);

  return (
    <div style={{ position: "relative", width: videoWidth, height: videoHeight }}>
      <Webcam
        ref={webcamRef}
        width={videoWidth}
        height={videoHeight}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      <button onClick={enableCam} style={{ marginTop: videoHeight + 10 }}>
        {webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS"}
      </button>
    </div>
  );
};

export default WebcamComponent;
