// const {createProxyMiddleware} = require('http-proxy-middleware');
// const express = require('express');
// const path = require('path');
// const app = express();

// // CORS 설정
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//   next();
// });
// // 백엔드 API 라우트
// app.get("/health", function(req, res) {
//   res.status(200).send("OK");
//   console.log("health check");
// });

// app.use('/', createProxyMiddleware({
//     target: 'http://frontend:3001', // Docker 내부의 프론트엔드 서비스 주소
//     changeOrigin: true,
//     ws: true, // 웹소켓 지원
//     logLevel: 'debug' // 디버깅을 위해 로그 레벨 설정
// }));

// // 서버 리슨 포트
// app.listen(3000, function () {
//   console.log("3000 Port : Server Started~!!!");
// });


// // backend/server/app.js
// const express = require('express');
// const http = require('http');
// const WebSocket = require('ws');
// const cors = require('cors'); // CORS 미들웨어 추가
// const axios = require('axios'); // axios 라이브러리 추가

// const app = express();
// const server = http.createServer(app);
// const wss = new WebSocket.Server({ server });

// // CORS 설정: 모든 도메인에서의 요청을 허용 하기 위해서 함
// app.use(cors());

// // JSON 요청 본문을 파싱하기 위한 미들웨어
// app.use(express.json());

// // 루트 경로에 대한 간단한 HTTP 응답 (굳이 안해도 되긴 함..)
// app.get('/', (req, res) => {
//     res.send('Node.js WebSocket server is running for posture analysis.');
// });

// // 클라이언트로부터 WebSocket 연결이 들어왔을 때 설정
// wss.on('connection', ws => {
//     console.log('Client connected to WebSocket server');

//     // 클라이언트로부터 메시지를 받았을 때
//     ws.on('message', message => {
//         // 메시지가 이미지 프레임 데이터라고 가정
//         console.log('Received message from client (frame data or control signal)');

//         // FastAPI 백엔드로 데이터 전송
//         forwardToFastAPI(message.toString());
//     });

//     // 연결이 끊겼을 때
//     ws.on('close', () => {
//         console.log('Client disconnected from WebSocket server');
//     });

//     // 오류 발생 시
//     ws.on('error', error => {
//         console.error('WebSocket error:', error);
//     });
// });

// // FastAPI 백엔드로 데이터 전달 함수
// async function forwardToFastAPI(imageData) {
//     const fastapiUrl = 'http://localhost:8000/analyze-pose'; // FastAPI 서버 주소 (추후 변경 필요)
//     try {
//         const response = await axios.post(fastapiUrl, { image_data: imageData }, { // axios.post 사용
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//         });
//         const result = response.data; // axios는 응답 데이터를 response.data에 담습니다.
//         console.log('FastAPI response:', result);

//         // FastAPI에서 받은 분석 결과를 다시 클라이언트(React 앱)로 WebSocket을 통해 전달
//         wss.clients.forEach(client => {
//             if (client.readyState === WebSocket.OPEN) {
//                 client.send(JSON.stringify(result)); // 분석 결과를 클라이언트에게 전송
//             }
//         });

//     } catch (error) {
//         console.error('Error forwarding data to FastAPI:', error);
//         // axios 오류는 error.response (HTTP 오류), error.request (네트워크 오류), error.message (기타) 로 구분할 수 있습니다.
//         if (error.response) {
//             console.error('FastAPI responded with status:', error.response.status);
//             console.error('FastAPI response data:', error.response.data);
//         } else if (error.request) {
//             console.error('No response received from FastAPI:', error.request);
//         } else {
//             console.error('Error setting up request:', error.message);
//         }
//     }
// }

// const PORT = process.env.PORT || 3001; 
// server.listen(PORT, () => {
//     console.log(`Node.js WebSocket server listening on port ${PORT}`);
// });


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

app.use('/', createProxyMiddleware({
    target: 'http://frontend:3001', // Docker 내부의 프론트엔드 서비스 주소
    changeOrigin: true,
    ws: true, // 웹소켓 지원
    logLevel: 'debug' // 디버깅을 위해 로그 레벨 설정
}));

// ★★★★ 이 부분을 추가해야 합니다! ★★★★
const PORT = process.env.PORT || 3000; // 환경 변수 PORT가 있으면 사용하고, 없으면 3000번 포트 사용
app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});