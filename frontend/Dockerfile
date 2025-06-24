FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install && npm install -g serve

COPY . .

RUN npm run build

EXPOSE 3001
CMD ["serve", "-s", "dist", "-l", "3001"]
