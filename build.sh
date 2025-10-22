#!/bin/bash

# Build script for Library Management System
set -e

# 환경 변수 확인
REGISTRY=${REGISTRY:-"your-registry.io/library"}
VERSION=${VERSION:-"v1.0.0"}

echo "=================================="
echo "Building Library Management System"
echo "Registry: $REGISTRY"
echo "Version: $VERSION"
echo "=================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수 정의
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Docker 확인
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# 1. User Service
print_info "Building user-service..."
cd services/user-service
docker build -t $REGISTRY/user-service:$VERSION .
docker tag $REGISTRY/user-service:$VERSION $REGISTRY/user-service:latest
print_info "✓ user-service built successfully"
cd ../..

# 2. Book Service
print_info "Building book-service..."
cd services/book-service
docker build -t $REGISTRY/book-service:$VERSION .
docker tag $REGISTRY/book-service:$VERSION $REGISTRY/book-service:latest
print_info "✓ book-service built successfully"
cd ../..

# 3. Cart Service
print_info "Building cart-service..."
cd services/cart-service
docker build -t $REGISTRY/cart-service:$VERSION .
docker tag $REGISTRY/cart-service:$VERSION $REGISTRY/cart-service:latest
print_info "✓ cart-service built successfully"
cd ../..

# 4. API Gateway
print_info "Building api-gateway..."
cd services/api-gateway
docker build -t $REGISTRY/api-gateway:$VERSION .
docker tag $REGISTRY/api-gateway:$VERSION $REGISTRY/api-gateway:latest
print_info "✓ api-gateway built successfully"
cd ../..

# 5. Frontend
print_info "Building frontend..."
cd frontend
docker build -t $REGISTRY/frontend:$VERSION .
docker tag $REGISTRY/frontend:$VERSION $REGISTRY/frontend:latest
print_info "✓ frontend built successfully"
cd ..

print_info "=================================="
print_info "All images built successfully!"
print_info "=================================="

# 이미지 목록 출력
print_info "Built images:"
docker images | grep "$REGISTRY"

# Push 옵션
read -p "Do you want to push images to registry? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Pushing images to $REGISTRY..."

    docker push $REGISTRY/user-service:$VERSION
    docker push $REGISTRY/user-service:latest

    docker push $REGISTRY/book-service:$VERSION
    docker push $REGISTRY/book-service:latest

    docker push $REGISTRY/cart-service:$VERSION
    docker push $REGISTRY/cart-service:latest

    docker push $REGISTRY/api-gateway:$VERSION
    docker push $REGISTRY/api-gateway:latest

    docker push $REGISTRY/frontend:$VERSION
    docker push $REGISTRY/frontend:latest

    print_info "✓ All images pushed successfully!"
else
    print_warn "Skipping push. You can push manually later with:"
    echo "  docker push $REGISTRY/user-service:$VERSION"
    echo "  docker push $REGISTRY/book-service:$VERSION"
    echo "  docker push $REGISTRY/cart-service:$VERSION"
    echo "  docker push $REGISTRY/api-gateway:$VERSION"
    echo "  docker push $REGISTRY/frontend:$VERSION"
fi

print_info "Build completed!"
