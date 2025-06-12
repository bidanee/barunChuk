# FROM node:18
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# EXPOSE 5000
# CMD ["node", "app.js"]

# backend/server/Dockerfile
FROM node:20-alpine # Node.js 18 -> 20 (LTS 최신 버전 권장, 더 가벼운 alpine)

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production # 프로덕션 의존성만 설치하여 이미지 크기 최적화 (개발 의존성은 제외)

COPY . .

EXPOSE 5000
CMD ["node", "app.js"]