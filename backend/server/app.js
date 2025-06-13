const {createProxyMiddleware} = require('http-proxy-middleware');
const express = require('express');
const path = require('path');
const app = express();

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
// 백엔드 API 라우트
app.get("/health", function(req, res) {
  res.status(200).send("OK");
  console.log("health check");
});

app.use('/video', createProxyMiddleware({
    target: 'http://56.155.62.180:3000',
    changeOrigin: true,
    logLevel: 'debug' // 디버깅을 위해 로그 레벨 설정
}));

app.use('/', createProxyMiddleware({
    target: 'http://frontend:3001', // Docker 내부의 프론트엔드 서비스 주소
    changeOrigin: true,
    ws: true, // 웹소켓 지원
    logLevel: 'debug' // 디버깅을 위해 로그 레벨 설정
}));

// 서버 리슨 포트
app.listen(3000, function () {
  console.log("3000 Port : Server Started~!!!");
});