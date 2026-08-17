# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Cài đặt công cụ build cho các thư viện C++ native như argon2 (Python, make, g++)
RUN apk add --no-cache python3 make g++

# Copy dependency configs
COPY package*.json ./

# Cài đặt tất cả dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code
COPY . .

# Build dự án NestJS
RUN npm run build

# Loại bỏ devDependencies để thu nhỏ dung lượng node_modules
RUN npm prune --production

# Stage 2: Production runtime stage
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy package.json để ứng dụng đọc metadata nếu cần
COPY package*.json ./

# Copy trực tiếp node_modules đã tối ưu từ Stage 1 (KHÔNG cần npm ci lại)
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy built code từ Stage 1
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/src/infrastructure/proto ./dist/infrastructure/proto

# Set ownership cho user 'node'
RUN chown -R node:node /usr/src/app

USER node

EXPOSE 3000
EXPOSE 50052

CMD ["node", "dist/main"]