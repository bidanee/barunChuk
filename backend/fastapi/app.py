# import uvicorn
# from fastapi import FastAPI
# app = FastAPI()

# @app.get("/")
# async def root():
#   return {"message": "Hello World"}

# if __name__ == "__main__":
#   uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import numpy as np
import cv2
# OpenCV 사용 불가능하므로, 실제 이미지 처리에는 PIL 등 다른 라이브러리 고려
# from PIL import Image # Pillow 라이브러리 사용 시
# import io # Pillow 사용 시 필요

app = FastAPI()

# CORS 설정: Node.js 서버(FastAPI 클라이언트)로부터의 요청 허용
# Docker Compose 네트워크에서 Node.js는 FastAPI와 내부적으로 통신하므로,
# 실제로는 Docker 네트워크 내의 Node.js 컨테이너 이름(backend-node)으로부터의 요청을 허용하게 됩니다.
app.add_middleware(
    CORSMiddleware,
        allow_origins=[
        "http://backend-node:3000",  # Node.js 서버의 내부 네트워크 주소
        "https://barunchuk.5team.store", # 실제 프런트엔드 도메인
        "http://localhost:3001", # 개발용으로 로컬 React 앱 접근
        "http://forntend:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메서드 허용 (GET, POST 등)
    allow_headers=["*"],  # 모든 헤더 허용
)

# 이미지 데이터를 받을 Pydantic 모델 정의
class ImageData(BaseModel):
    image_data: str # Base64 인코딩된 이미지 문자열

# 루트 경로 핸들러
@app.get("/")
async def read_root():
    return {"message": "FastAPI Posture Analysis Backend is running!"}

# 자세 분석 엔드포인트
@app.post("/analyze-pose")
async def analyze_pose(data: ImageData):
    """
    Node.js 서버로부터 Base64 인코딩된 이미지 데이터를 받아 자세를 분석합니다.
    """
    try:
        # Base64 이미지 데이터를 디코딩합니다.
        # Node.js에서 'data:image/png;base64,' 접두사를 붙여 보냈다면 제거해야 합니다.
        if "base64," in data.image_data:
            header, encoded_data = data.image_data.split(",", 1)
        else:
            encoded_data = data.image_data
            
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        
        # OpenCV는 EC2에서 사용할 수 없다고 하셨으므로,
        # 이 부분은 실제 이미지 처리 라이브러리(PIL 등)로 대체해야 합니다.
        # 현재는 예시를 위해 OpenCV 코드를 주석으로 남겨둡니다.
        # img = cv2.imdecode(nparr, cv2.IMREAD_COLOR) # OpenCV 이미지로 디코딩
        
        # if img is None:
        #     raise ValueError("Image decoding failed.")

        # --- 실제 자세 분석 로직 (TODO: 이 부분에 MediaPipe Python 코드 통합) ---
        # OpenCV를 사용할 수 없으므로, MediaPipe Python 라이브러리를 직접 사용하거나
        # 다른 이미지 처리 라이브러리(Pillow 등)로 이미지 데이터를 준비해야 합니다.
        #
        # 예시: Pillow를 사용하여 이미지 처리 (설치 필요: pip install Pillow)
        # from PIL import Image
        # import io
        # image_bytes = base64.b64decode(encoded_data)
        # img = Image.open(io.BytesIO(image_bytes))
        #
        # 여기서는 단순히 가상의 자세 점수와 피드백을 반환합니다.
        import random
        posture_score = random.randint(50, 100) # 가상의 자세 점수
        feedback_messages = [
            "좋은 자세를 유지하고 있습니다! 👍",
            "목이 앞으로 나와 있어요. 거북목에 주의하세요.",
            "등이 굽어 있습니다. 허리를 펴고 앉으세요.",
            "어깨가 한쪽으로 기울어져 있습니다. 자세를 바르게 해주세요."
        ]
        posture_feedback = random.choice(feedback_messages) # 가상의 피드백

        # --- 분석 결과 반환 ---
        return {
            "status": "success",
            "posture_score": posture_score,
            "feedback": posture_feedback,
            "timestamp": "some_timestamp" # 실제 시간 정보를 포함할 수 있음
            # "landmarks": [] # 분석된 랜드마크 데이터 (필요 시 추가)
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing or analysis failed: {e}")

