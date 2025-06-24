FROM python:3.11-slim-buster

# 환경 변수 설정 (옵션)
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# requirements.txt 복사 및 Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


