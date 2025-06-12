# FROM python:3.11
# WORKDIR /app
# COPY requirements.txt .
# RUN pip install -r requirements.txt
# COPY . .
# EXPOSE 8000
# CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

# backend/fastapi/Dockerfile
# MediaPipe 의존성인 libgl1-mesa-glx, libsm6, libxext6, libxrender1 설치 추가
FROM python:3.11-slim-buster

WORKDIR /app

# apt 업데이트 및 필요한 패키지 설치 (MediaPipe 의존성)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt 복사 및 의존성 설치
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt 

# 모든 소스 코드 복사
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]