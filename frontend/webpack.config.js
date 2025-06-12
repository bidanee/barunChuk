const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
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
      port: 3000,
      static: path.join(__dirname, 'public'), 
      open: true,
      watchFiles: {
        paths: ['src/**/*', 'public/**/*'], // 감지할 파일/폴더 명시
        options: {
          usePolling: true, // 폴링 사용을 명시
          interval: 1000 // 1초(1000ms)마다 파일 변경 여부를 주기적으로 확인
        }
      }
    },
  mode: 'development'
};
