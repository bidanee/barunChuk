FROM node:20-alpine

WORKDIR /app

# 전체 복사
COPY . .

# 의존성 설치
RUN npm install

# 웹팩 빌드
RUN npm run build

# 정적 파일 서빙을 위해 serve 설치
RUN npm install -g serve

EXPOSE 3001
CMD ["serve", "-s", "dist", "-l", "3001"]
