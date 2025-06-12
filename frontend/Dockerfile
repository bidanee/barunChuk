# FROM node:18
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# EXPOSE 3000
# CMD ["npm", "start"]

# frontend/Dockerfile
FROM node:20-alpine # Node.js 18 -> 20 (LTS 최신 버전 권장, 더 가벼운 alpine)

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install # 개발 의존성 포함 (hot-reloading 등을 위해)

COPY . .

EXPOSE 3000
CMD ["npm", "start"] # React 개발 서버 실행