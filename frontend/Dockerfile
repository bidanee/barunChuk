FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm run build

COPY . .

EXPOSE 3001
CMD ["serve", "-s", "dist", "-l", "3000"]