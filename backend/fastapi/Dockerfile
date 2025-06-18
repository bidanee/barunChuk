FROM python:3.11-slim-buster

# 환경 변수 설정 (옵션)
ENV PYTHONUNBUFFERED 1

# 필요한 시스템 패키지 설치
# MediaPipe/OpenCV가 의존하는 gstreamer 관련 라이브러리 및 기타 종속성 설치
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer1.0-0 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# requirements.txt 복사 및 Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
