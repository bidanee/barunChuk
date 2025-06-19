# backend/fastapi/app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import base64
import numpy as np
from PIL import Image
import io
import mediapipe as mp
import random
import logging

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://backend-node:3000","https://barunchuck.5team.store","http://localhost:3001","http://frontend:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float
    visibility: Optional[float] = 0.0

class AnalysisData(BaseModel):
    imageData: str
    referencePoseData: Optional[List[LandmarkPoint]] = None

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=0, # 모델 복잡도를 0으로 설정 (가장 빠르고 경량화된 모델)
    min_detection_confidence=0.01, # 감지 신뢰도 최저로 낮춤
    min_tracking_confidence=0.01,  # 추적 신뢰도 최저로 낮춤
)
logging.info("MediaPipe Pose model initialized with model_complexity=0, min_detection_confidence=0.01, min_tracking_confidence=0.01")

# --- 헬퍼 함수: 필수 랜드마크의 가시성 유효성 검사 (상세 로깅) ---
def _check_essential_landmarks_validity(landmarks: List[LandmarkPoint], threshold: float) -> bool:
    """
    주요 랜드마크(코, 귀, 어깨)의 가시성이 특정 임계값 이상인지 확인합니다.
    어떤 랜드마크가 실패했는지 상세히 로깅합니다.
    """
    essential_indices = [
        mp_pose.PoseLandmark.NOSE,
        mp_pose.PoseLandmark.LEFT_EAR,
        mp_pose.PoseLandmark.RIGHT_EAR,
        mp_pose.PoseLandmark.LEFT_SHOULDER,
        mp_pose.PoseLandmark.RIGHT_SHOULDER,
    ]
    
    if len(landmarks) < max(essential_indices) + 1:
        logging.warning("Landmark list is too short to contain all essential landmarks.")
        return False

    for idx in essential_indices:
        landmark_name = mp_pose.PoseLandmark(idx).name # 랜드마크 이름 가져오기
        if not (landmarks[idx] and isinstance(landmarks[idx].visibility, (int, float)) and landmarks[idx].visibility is not None):
            logging.warning(f"Essential landmark {idx} ({landmark_name}) has invalid visibility property (not number or None).")
            return False
        
        if landmarks[idx].visibility <= threshold:
            logging.warning(f"Essential landmark {idx} ({landmark_name}) visibility ({landmarks[idx].visibility:.2f}) is below threshold ({threshold}).")
            return False
    return True

@app.get("/")
async def read_root():
    return {"message": "FastAPI Posture Analysis Backend is running with MediaPipe!"}

@app.post("/analyze-pose")
async def analyze_pose(data: AnalysisData):
    """
    Node.js 서버로부터 Base64 인코딩된 이미지 데이터를 받아 자세를 분석합니다.
    """
    try:
        encoded_data = data.imageData.split(",", 1)[1] if "base64," in data.imageData else data.imageData
        image_bytes = base64.b64decode(encoded_data)
        
        image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_pil = image_pil.transpose(Image.FLIP_LEFT_RIGHT)
        logging.info("Image flipped horizontally in FastAPI for MediaPipe processing.")

        image_np = np.array(image_pil)
        
        if image_np.size == 0 or image_np.shape[0] == 0 or image_np.shape[1] == 0:
            logging.error("Empty or invalid numpy image array received.")
            raise ValueError("Empty or invalid image data.")

        results = pose.process(image_np)

        posture_score = 0
        feedback_message = "자세를 감지하지 못했습니다."
        current_landmarks_data = []

        if results.pose_landmarks:
            logging.info(f"Current Landmarks detected! Number of landmarks: {len(results.pose_landmarks.landmark)}")
            for landmark in results.pose_landmarks.landmark:
                current_landmarks_data.append({
                    "x": landmark.x, "y": landmark.y, "z": landmark.z, "visibility": landmark.visibility
                })
            
            curr_nose = results.pose_landmarks.landmark[mp_pose.PoseLandmark.NOSE]
            curr_left_ear = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_EAR]
            curr_right_ear = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_EAR]
            curr_left_shoulder = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_SHOULDER]
            curr_right_shoulder = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_SHOULDER]

            # --- 현재 자세 필수 랜드마크 가시성 확인 ---
            # 임계값을 0.1에서 0.05로 더 낮춰서 유연하게 감지 (혹은 0.01까지)
            CURRENT_POSE_VISIBILITY_THRESHOLD = 0.05 
            is_current_pose_valid = _check_essential_landmarks_validity(results.pose_landmarks.landmark, CURRENT_POSE_VISIBILITY_THRESHOLD)
            
            if is_current_pose_valid: # 현재 자세의 필수 랜드마크가 유효할 때만 분석 시작
                score_adjustment = 0
                feedback_parts = []

                avg_shoulder_y_curr = (curr_left_shoulder.y + curr_right_shoulder.y) / 2
                avg_ear_y_curr = (curr_left_ear.y + curr_right_ear.y) / 2
                
                if data.referencePoseData: # 기준 자세 랜드마크가 전달된 경우
                    reference_landmarks = data.referencePoseData
                    logging.info(f"Reference pose data received. Length: {len(reference_landmarks)}")

                    # 기준 자세 필수 랜드마크 유효성 확인 (더욱 유연하게)
                    REFERENCE_POSE_VISIBILITY_THRESHOLD = 0.01 # 0.01로 유지
                    is_reference_pose_valid = _check_essential_landmarks_validity(reference_landmarks, REFERENCE_POSE_VISIBILITY_THRESHOLD)

                    if not is_reference_pose_valid:
                        feedback_parts.append("기준 자세 랜드마크의 가시성이 낮거나 불안정하여 비교가 어렵습니다. 기준 자세를 카메라 앞에서 바르게 다시 설정해보세요.")
                        posture_score = random.randint(30, 50)
                        logging.warning(f"Reference pose is invalid due to low visibility (threshold {REFERENCE_POSE_VISIBILITY_THRESHOLD}).")
                    else:
                        ref_nose = reference_landmarks[mp_pose.PoseLandmark.NOSE]
                        ref_left_ear = reference_landmarks[mp_pose.PoseLandmark.LEFT_EAR]
                        ref_right_ear = reference_landmarks[mp_pose.PoseLandmark.RIGHT_EAR]
                        ref_left_shoulder = reference_landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
                        ref_right_shoulder = reference_landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]

                        avg_shoulder_y_ref = (ref_left_shoulder.y + ref_right_shoulder.y) / 2
                        avg_ear_y_ref = (ref_left_ear.y + ref_right_ear.y) / 2
                        
                        ref_ear_shoulder_y_diff = avg_ear_y_ref - avg_shoulder_y_ref
                        curr_ear_shoulder_y_diff = avg_ear_y_curr - avg_shoulder_y_curr

                        NECK_FORWARD_THRESHOLD = 0.03 
                        NECK_BACKWARD_THRESHOLD = 0.015 
                        if curr_ear_shoulder_y_diff > ref_ear_shoulder_y_diff + NECK_FORWARD_THRESHOLD: 
                            feedback_parts.append("기준 자세보다 목이 앞으로 나와 거북목입니다.")
                            score_adjustment -= 25
                        elif curr_ear_shoulder_y_diff < ref_ear_shoulder_y_diff - NECK_BACKWARD_THRESHOLD:
                            feedback_parts.append("목 자세가 기준보다 좋습니다!")
                            score_adjustment += 15
                        else:
                            feedback_parts.append("목 자세는 기준과 유사합니다.")

                        curr_shoulder_y_diff_abs = abs(curr_left_shoulder.y - curr_right_shoulder.y)
                        ref_shoulder_y_diff_abs = abs(ref_left_shoulder.y - ref_right_shoulder.y)

                        SHOULDER_TILT_THRESHOLD = 0.03 
                        SHOULDER_FLAT_THRESHOLD = 0.015 
                        if curr_shoulder_y_diff_abs > ref_shoulder_y_diff_abs + SHOULDER_TILT_THRESHOLD: 
                            feedback_parts.append("기준 자세 대비 어깨가 더 기울어져 있습니다.")
                            score_adjustment -= 10
                        elif curr_shoulder_y_diff_abs < ref_shoulder_y_diff_abs - SHOULDER_FLAT_THRESHOLD:
                            feedback_parts.append("어깨 수평이 기준보다 좋습니다!")
                            score_adjustment += 5
                        else:
                            feedback_parts.append("어깨는 기준과 유사하게 수평입니다.")

                        feedback_message = " ".join(feedback_parts) + "."
                        posture_score = max(0, min(100, 70 + score_adjustment))

                else: # 기준 자세가 없는 경우 
                    logging.info("No reference pose data provided, analyzing current posture only.")
                    if avg_ear_y_curr > avg_shoulder_y_curr + 0.08: 
                        feedback_parts.append("목이 앞으로 나와 거북목입니다.")
                        score_adjustment -= 20
                    elif avg_ear_y_curr < avg_shoulder_y_curr - 0.04: 
                        feedback_parts.append("목 자세는 좋습니다!")
                        score_adjustment += 10
                    else:
                        feedback_parts.append("목 자세는 괜찮습니다.")
                    
                    if abs(curr_left_shoulder.y - curr_right_shoulder.y) > 0.05: 
                        feedback_parts.append("어깨가 기울어져 있어요.")
                        score_adjustment -= 10
                    else:
                        feedback_parts.append("어깨는 수평입니다.")
                    
                    if not feedback_parts:
                        feedback_message = "자세를 분석했습니다. 기준 자세를 설정하여 더 정확한 피드백을 받아보세요."
                    else: 
                        feedback_message = " ".join(feedback_parts) + ". " + "자세를 분석했습니다. 기준 자세를 설정하여 더 정확한 피드백을 받아보세요."

                    posture_score = max(0, min(100, posture_score))
            else: 
                logging.warning(f"Current pose essential landmarks have low visibility (threshold {CURRENT_POSE_VISIBILITY_THRESHOLD}).")
                feedback_message = "현재 자세 랜드마크(코, 귀, 어깨)의 가시성이 낮습니다. 카메라에 얼굴과 어깨가 잘 나오도록 확인해주세요."
                posture_score = random.randint(20, 50) 

        else: 
            logging.warning("No pose landmarks detected by MediaPipe for current frame.")
            feedback_message = "자세를 감지하지 못했습니다. 카메라에 전신이 잘 나오도록 해주세요."
            posture_score = random.randint(0, 30)

        return {
            "status": "success",
            "posture_score": posture_score,
            "feedback": feedback_message,
            "timestamp": "some_timestamp",
            "landmarks": current_landmarks_data
        }

    except Exception as e:
        logging.error(f"Error during pose analysis: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Image processing or analysis failed: {e}. Ensure image data is valid and MediaPipe is correctly configured.")

