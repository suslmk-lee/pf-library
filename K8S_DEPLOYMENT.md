# Kubernetes 배포 가이드

이 문서는 Library Management System을 Kubernetes 환경에 배포하는 방법을 설명합니다.

## 주요 변경사항

### 1. API Gateway 기본값 변경
- **로컬 개발**: `.env.local`에서 `localhost` 주소 사용
- **Kubernetes**: 기본값이 Kubernetes Service DNS로 설정됨
  ```
  http://user-service.default.svc.cluster.local:8080
  http://book-service.default.svc.cluster.local:8080
  http://cart-service.default.svc.cluster.local:8080
  ```

### 2. Frontend 프록시 설정
- **로컬 개발**: Vite dev server가 `/api` → `localhost:8080`으로 프록시
- **Kubernetes**: Nginx가 `/api` → `api-gateway:8080`으로 프록시
- 코드 변경 없이 두 환경 모두 지원

### 3. 환경별 설정

#### 로컬 개발
`.env.local` 파일 사용:
```bash
USER_SERVICE_ADDR=http://localhost:8081
BOOK_SERVICE_ADDR=http://localhost:8082
CART_SERVICE_ADDR=http://localhost:8083
```

#### Kubernetes
환경변수 또는 기본값 사용:
```yaml
env:
  - name: USER_SERVICE_ADDR
    value: "http://user-service.default.svc.cluster.local:8080"
```

## Kubernetes 배포 순서

### 1. ConfigMap 및 Secret 생성
```bash
kubectl apply -f k8s/configmap-example.yaml
```

### 2. 각 서비스 배포

#### User Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: registry.k-paas.org/kpaas/user-service:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: PORT
          value: "8080"
        envFrom:
        - configMapRef:
            name: library-config
        - secretRef:
            name: library-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

#### Book Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: book-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: book-service
  template:
    metadata:
      labels:
        app: book-service
    spec:
      containers:
      - name: book-service
        image: registry.k-paas.org/kpaas/book-service:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: PORT
          value: "8080"
        envFrom:
        - configMapRef:
            name: library-config
        - secretRef:
            name: library-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: book-service
spec:
  selector:
    app: book-service
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

#### Cart Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cart-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cart-service
  template:
    metadata:
      labels:
        app: cart-service
    spec:
      containers:
      - name: cart-service
        image: registry.k-paas.org/kpaas/cart-service:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: PORT
          value: "8080"
        envFrom:
        - configMapRef:
            name: library-config
        - secretRef:
            name: library-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: cart-service
spec:
  selector:
    app: cart-service
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

#### API Gateway
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: registry.k-paas.org/kpaas/api-gateway:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: PORT
          value: "8080"
        # 서비스 주소는 기본값 사용 (오버라이드 필요시만 설정)
        # - name: USER_SERVICE_ADDR
        #   value: "http://user-service.default.svc.cluster.local:8080"
        envFrom:
        - configMapRef:
            name: library-config
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  selector:
    app: api-gateway
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

#### Frontend
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: registry.k-paas.org/kpaas/frontend:v1.0.0
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer  # 또는 Ingress 사용
```

### 3. Ingress (선택사항)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: library-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: library.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

## 중요 사항

### ✅ 문제 해결된 부분

1. **서비스 디스커버리**: API Gateway가 Kubernetes Service DNS 기본값 사용
2. **환경 분리**: 로컬 개발과 Kubernetes 환경 자동 구분
3. **프록시 설정**: Frontend Nginx가 `/api`를 API Gateway로 자동 전달
4. **포트 표준화**: Kubernetes에서는 모든 서비스가 8080 포트 사용

### ⚠️ 주의 사항

1. **네임스페이스**: 예시는 `default` 네임스페이스 사용. 다른 네임스페이스 사용 시 FQDN 수정 필요
2. **이미지 레지스트리**: `registry.k-paas.org/kpaas`를 실제 레지스트리 주소로 변경
3. **데이터베이스/Redis**: MariaDB와 Redis는 별도로 배포 필요
4. **시크릿 관리**: 프로덕션에서는 비밀번호를 Secret으로 관리

## 배포 테스트

```bash
# 모든 Pod 상태 확인
kubectl get pods

# 서비스 확인
kubectl get svc

# API Gateway 로그 확인
kubectl logs -f deployment/api-gateway

# Frontend 접속 테스트
kubectl port-forward svc/frontend 8080:80
# 브라우저에서 http://localhost:8080 접속
```

## 로컬 개발 환경

로컬에서 개발 시:
1. `.env.local` 파일이 자동으로 로드됨
2. Vite dev server가 `/api` 프록시 처리
3. 모든 서비스가 localhost의 다른 포트에서 실행

Kubernetes 배포 시:
1. `.env.local` 파일 무시됨 (컨테이너에 포함되지 않음)
2. 환경변수 또는 기본값 사용
3. 모든 서비스가 Kubernetes Service DNS로 통신
