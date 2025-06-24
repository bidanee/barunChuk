FROM node:20-alpine

WORKDIR /app

COPY package.json ./

# 의존성 설치
RUN npm install

# build 실행
RUN npm run build

# 나머지 파일 복사
COPY . .

EXPOSE 3001
CMD ["serve", "-s", "dist", "-l", "3001"]
