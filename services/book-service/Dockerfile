# Multi-stage build for book-service
FROM golang:1.21-alpine AS builder

WORKDIR /app

# 의존성 복사 및 다운로드
COPY go.mod ./
RUN go mod download

# 소스 코드 복사 및 빌드
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o book-service .

# 최종 이미지
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# 빌드된 바이너리 복사
COPY --from=builder /app/book-service .

EXPOSE 8080

CMD ["./book-service"]
