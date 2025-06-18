
const express = require('express');
const http = require('http');
const cors = require('cors');
const axios = require('axios'); 
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Socket.IO 서버를 HTTP 서버에 연결
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3001", "https://barunchuk.5team.store"], // React 앱의 개발 및 배포 주소
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io" 
});

app.use(cors())
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Node.js Socket.IO server is running for posture analysis.');
});

// socket event 처리부분
io.on('connection', (socket) => {
    console.log(`Socket.IO client connected: ${socket.id}`);

    // client에서 이미지 받았을때?
    socket.on('image_frame', (imageData) => {
        // FastAPI로 데이터 전달
        forwardToFastAPI(imageData, socket); // socket 객체를 전달하여 특정 클라이언트에게 응답하게끔
    });

    // 연결이 끊겼을 때
    socket.on('disconnect', () => {
        console.log(`Socket.IO client disconnected: ${socket.id}`);
    });

    // 오류 발생 시
    socket.on('error', (error) => {
        console.error(`Socket.IO error for client ${socket.id}:`, error);
    });
});

// FastAPI 백엔드로 데이터 전달 함수
async function forwardToFastAPI(imageData, clientSocket) {
    const fastapiUrl = 'http://backend-python:8000/analyze-pose'; 
    try {
        const response = await axios.post(fastapiUrl, { image_data: imageData }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const result = response.data;
        // FastAPI에서 받은 분석 결과를 해당 클라이언트한테 다시 전송함
        clientSocket.emit('analysis_result', result);

    } catch (error) {
        console.error('Error forwarding data to FastAPI:', error);
        if (error.response) {
            console.error('FastAPI responded with status:', error.response.status);
            console.error('FastAPI response data:', error.response.data);
        } else if (error.request) {
            console.error('No response received from FastAPI:', error.request);
        } else {
            console.error('Error setting up request:', error.message);
        }
        // 오류 알림, 지워도됨
        clientSocket.emit('analysis_error', { detail: 'Failed to analyze pose.' });
    }
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Node.js Socket.IO server listening on port ${PORT}`);
});