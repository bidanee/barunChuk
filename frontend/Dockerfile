# FROM node:18
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# EXPOSE 3000
# CMD ["npm", "start"]

# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install 

COPY . .

EXPOSE 3001
CMD ["npm", "start"] 