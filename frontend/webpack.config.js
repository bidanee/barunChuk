// barunChuk/frontend/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'), // 빌드 결과물이 저장될 경로 (이 경로가 호스트에 생성됩니다)
    filename: 'bundle.js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html'
    })
  ],
  devServer: {
    host:'0.0.0.0',
    port: 3001, // 현재 3001로 설정되어 있습니다. (이 부분은 docker-compose.yml과 맞춰야 합니다)
    static: path.join(__dirname, 'public'),
    open: true,
    // devMiddleware 섹션
    historyApiFallback: true,
    devMiddleware: {
      writeToDisk: true, // ⭐⭐ 개발 중에도 빌드 결과물을 디스크(./dist)에 씁니다.
    },
    
    watchFiles: {
      paths: ['src/**/*', 'public/**/*'], // 감지할 파일/폴더 명시
      options: {
        usePolling: true, // 폴링 사용을 명시
        interval: 1000 // 1초(1000ms)마다 파일 변경 여부를 주기적으로 확인
      }
    },
      allowedHosts: 'all' // 또는 ['all'] (문자열 'all' 또는 배열 ['all'] 사용 가능)
    // 만약 특정 도메인만 허용하고 싶다면: allowedHosts: ['.barunchuk.5team.store', 'frontend']
    
  },
  mode: 'development'
};