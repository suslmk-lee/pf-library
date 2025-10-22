# Multi-stage build for api-gateway
FROM golang:1.21-alpine AS builder

WORKDIR /app

# 의존성 복사 및 다운로드
COPY go.mod ./
RUN go mod download

# 소스 코드 복사 및 빌드
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o api-gateway .

# 최종 이미지
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# 빌드된 바이너리 복사
COPY --from=builder /app/api-gateway .

EXPOSE 8080

CMD ["./api-gateway"]
