# backend/fastapi/app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import numpy as np
from PIL import Image # Pillow 라이브러리 임포트
import io # BytesIO를 위해 임포트
import mediapipe as mp # MediaPipe 라이브러리 임포트

app = FastAPI()
# CORS 설정
app.add_middleware(
    CORSMiddleware,
        allow_origins=[
        "http://backend-node:3000",  # Node.js 서버의 내부 네트워크 주소
        "https://barunchuk.5team.store", # 실제 프런트엔드 도메인
        "http://localhost:3001", # 개발용으로 로컬 React 앱 접근
        "http://forntend:3001"
    ], # 개발 단계용. 배포 시에는 특정 출처로 제한 (예: "http://backend-node:3000")
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 이미지 데이터를 받을 Pydantic 모델 정의
class ImageData(BaseModel):
    image_data: str # Base64 인코딩된 이미지 문자열

# MediaPipe Pose 모델 초기화
# 한 번만 초기화하여 재사용하도록 전역 또는 앱 시작 시 설정
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False, # 비디오 스트림이므로 False (추적 모드)
    model_complexity=1,     # 모델 복잡도 (0, 1, 2). 1이 좋은 밸런스.
    min_detection_confidence=0.5, # 최소 감지 신뢰도
    min_tracking_confidence=0.5  # 최소 추적 신뢰도
)

# 루트 경로 핸들러
@app.get("/")
async def read_root():
    return {"message": "FastAPI Posture Analysis Backend is running with MediaPipe!"}

# 자세 분석 엔드포인트
@app.post("/analyze-pose")
async def analyze_pose(data: ImageData):
    """
    Node.js 서버로부터 Base64 인코딩된 이미지 데이터를 받아 자세를 분석합니다.
    """
    try:
        # 1. Base64 이미지 데이터를 디코딩하여 PIL Image 객체로 변환
        if "base64," in data.image_data:
            header, encoded_data = data.image_data.split(",", 1)
        else:
            encoded_data = data.image_data
            
        image_bytes = base64.b64decode(encoded_data)
        image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB") # RGB로 변환하여 MediaPipe 호환

        # 2. PIL Image를 MediaPipe가 처리할 수 있는 numpy 배열로 변환 (BGR 순서 필요 시 cvtColor 사용)
        # MediaPipe는 기본적으로 RGB를 기대하므로, PIL Image의 RGB를 바로 사용
        image_np = np.array(image_pil)
        # 만약 MediaPipe가 BGR을 기대한다면 (OpenCV와의 호환성 때문에), 아래 줄 주석 해제:
        # image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR) # OpenCV 없으므로 이 줄은 예시일 뿐

        # 3. MediaPipe Pose 모델로 이미지 처리
        results = pose.process(image_np)

        # 4. 자세 분석 및 결과 생성
        posture_score = 0
        feedback_message = "자세를 감지하지 못했습니다."
        
        landmarks_data = []
        if results.pose_landmarks:
            # 랜드마크 데이터 추출 및 저장 (옵션)
            for landmark in results.pose_landmarks.landmark:
                landmarks_data.append({
                    "x": landmark.x,
                    "y": landmark.y,
                    "z": landmark.z,
                    "visibility": landmark.visibility
                })
            
            # --- 자세 점수 및 피드백 계산 로직 ---
            # 여기서 앉은 자세에 특화된 분석 로직을 구현합니다.
            # 예시: 귀, 어깨, 엉덩이 랜드마크를 활용한 거북목 및 등 굽음 분석
            left_ear = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_EAR]
            right_ear = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_EAR]
            left_shoulder = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_SHOULDER]
            right_shoulder = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_SHOULDER]
            left_hip = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_HIP]
            right_hip = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_HIP]

            # 가상의 거북목 각도 계산 (간단화된 예시)
            # 어깨(Y)와 귀(Y)의 상대적인 위치로 목의 기울기 판단
            # Y축 값이 클수록 아래에 있음
            
            # 목 랜드마크가 유효한지 확인
            if (left_ear.visibility > 0.7 and right_ear.visibility > 0.7 and
                left_shoulder.visibility > 0.7 and right_shoulder.visibility > 0.7):
                
                # 어깨 평균 Y 좌표
                avg_shoulder_y = (left_shoulder.y + right_shoulder.y) / 2
                # 귀 평균 Y 좌표
                avg_ear_y = (left_ear.y + right_ear.y) / 2

                # 목이 앞으로 나왔는지 (거북목) 판단: 귀가 어깨보다 너무 아래에 있으면 거북목으로 간주 (Y좌표 기준)
                # 이 값은 카메라 각도, 사람의 체형에 따라 달라질 수 있으므로 조정 필요
                if avg_ear_y > avg_shoulder_y + 0.1: # 0.1은 임계값, 조정 필요
                    feedback_message = "거북목 자세입니다! 목을 뒤로 당겨주세요."
                    posture_score = random.randint(30, 60) # 안 좋은 점수
                elif avg_ear_y < avg_shoulder_y - 0.05: # 너무 뒤로 간 경우
                    feedback_message = "목 자세는 좋습니다."
                    posture_score = random.randint(70, 90) # 좋은 점수
                else:
                    feedback_message = "목 자세는 괜찮습니다."
                    posture_score = random.randint(60, 80) # 보통 점수

                # 등 굽음 판단 (어깨와 엉덩이의 X좌표 관계 등 복합적으로 판단 가능)
                # 여기서는 단순히 랜덤 점수를 기반으로 좋은 피드백을 추가
                if posture_score > 60:
                     feedback_message += " 등도 곧게 펴고 계시네요!"
                else:
                     feedback_message += " 등을 좀 더 펴주세요."

            else:
                feedback_message = "자세를 명확히 감지하기 어렵습니다. 카메라 위치를 확인해주세요."
                posture_score = 50 # 감지 어려울 때 기본 점수

        # --- 분석 결과 반환 ---
        return {
            "status": "success",
            "posture_score": posture_score,
            "feedback": feedback_message,
            "timestamp": "some_timestamp", # 실제 시간 정보를 포함할 수 있음
            "landmarks": landmarks_data # 분석된 랜드마크 데이터 (프런트엔드에서 활용 가능)
        }

    except Exception as e:
        print(f"Error during pose analysis: {e}") # 서버 로그에 오류 출력
        raise HTTPException(status_code=400, detail=f"Image processing or analysis failed: {e}. Ensure image data is valid and MediaPipe is correctly configured.")


