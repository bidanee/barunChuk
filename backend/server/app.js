const express = require('express');
const http = require('http');
const cors = require('cors');
const axios = require('axios'); 
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3001", "https://barunchuk.5team.store"],
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io",
  transports:['websocket'],
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.use(cors())
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Node.js Socket.IO server is running for posture analysis.');
});

// socket event 처리부분
io.on('connection', (socket) => {
    console.log(`Socket.IO client connected: ${socket.id}`);
    // --- 디버깅용: 연결 성공 시 클라이언트에게 메시지 보내기 ---
    socket.emit('connection_test', 'Node.js Socket.IO server connected successfully!');

    // client에서 이미지 받았을때?
    socket.on('image_frame', (imageData) => {
        // console.log(`Received image frame from client ${socket.id}`); 
        forwardToFastAPI(imageData, socket); // socket 객체를 전달하여 특정 클라이언트에게 응답하게끔
    });

    // 연결이 끊겼을 때
    socket.on('disconnect', (reason) => {
        console.log(`Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);
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
        const response = await axios.post(fastapiUrl, imageData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const result = response.data;
        // console.log('FastAPI response:', result); 
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

        clientSocket.emit('analysis_error', { detail: 'Failed to analyze pose.' });
    }
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Node.js Socket.IO server listening on port ${PORT}`);
});