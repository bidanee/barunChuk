// barunChuk/frontend/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  // 개발 모드 설정 (개발 중에는 'development', 배포 시에는 'production')
  mode: 'development',
  // 애플리케이션의 진입점
  entry: './src/index.jsx',
  // 번들된 파일이 출력될 경로와 파일명
  output: {
    path: path.resolve(__dirname, 'dist'), // 빌드 결과물이 저장될 경로 (이 경로가 호스트에 생성됩니다)
    filename: 'bundle.js',
    clean: true // 이전 빌드 결과물 삭제
  },
  // 모듈 해석 방식 설정
  resolve: {
    extensions: ['.js', '.jsx'] // .js와 .jsx 파일을 모듈로 인식
  },
  // 모듈 처리 규칙 정의
  module: {
    rules: [
      {
        // .js 또는 .jsx 파일에 대한 처리 규칙
        test: /\.(js|jsx)$/,
        exclude: /node_modules/, // node_modules 폴더는 제외
        use: 'babel-loader' // Babel을 사용하여 ES6+ 코드를 구형 브라우저에서 호환되도록 변환
      },
      {
        // .css 파일에 대한 처리 규칙
        test: /\.css$/,
        use: [
          'style-loader', // CSS를 DOM에 <style> 태그로 삽입
          'css-loader'    // CSS 파일을 CommonJS 모듈로 변환 (@import와 url() 처리)
        ]
      },
      {
        // 이미지 파일에 대한 처리 규칙
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource' // asset 모듈 타입으로 파일을 처리하여 출력 디렉터리에 복사
      },
      {
        // MediaPipe 모델 파일 (.task) 처리 규칙
        test: /\.task$/,
        type: 'asset/resource', // asset 모듈 타입으로 처리하여 파일 경로를 반환
        generator: {
          filename: 'dist/puvlick/[name][ext]' // public 폴더 구조를 유지하며 dist/static/ 에 복사
        }
      }
    ]
  },
  // 플러그인 설정
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html' // 번들된 JS 파일을 주입할 HTML 템플릿 파일
    })
  ],
  // 개발 서버 설정
  devServer: {
    host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접근 허용
    port: 3001, // React 개발 서버의 노출 포트
    // static 설정을 배열로 변경하여 public과 dist 폴더 모두를 서빙합니다.
    static: [
      { directory: path.join(__dirname, 'public') }, // 기존 public 폴더
      { directory: path.join(__dirname, 'dist') }    // Webpack 빌드 결과물 (assets) 폴더 추가
    ],
    open: true, // 서버 시작 시 브라우저 자동 열기
    historyApiFallback: true, // SPA (Single Page Application) 라우팅을 위한 설정
    devMiddleware: {
      writeToDisk: true // ⭐⭐ 개발 중에도 빌드 결과물을 디스크(./dist)에 씁니다.
    },
    watchFiles: {
      paths: ['src/**/*', 'public/**/*'], // 감지할 파일/폴더 명시
      options: {
        usePolling: true, // 폴링 사용을 명시 (WSL2 또는 Docker 환경에서 파일 변경 감지에 유용)
        interval: 1000 // 1초(1000ms)마다 파일 변경 여부를 주기적으로 확인
      }
    },
    allowedHosts: 'all', // 모든 호스트의 접근을 허용
    // webpack-dev-server 자체의 WebSocket 연결 URL 설정
    client: {
      // 클라이언트가 ALB를 통해 HTTPS/WSS로 접속하고 있으므로, 그에 맞춰 설정
      webSocketURL: {
        hostname: 'barunchuk.5team.store',
        protocol: 'wss', // HTTPS/WSS 프로토콜
        port: 443,       // ALB 리스너의 포트
        pathname: '/ws'  // webpack-dev-server의 기본 경로가 /ws이므로 맞춰줍니다.
      }
    }
  }
};
