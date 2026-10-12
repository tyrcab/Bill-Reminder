FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

# Cloud Run sets PORT env variable
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/index.js"]
