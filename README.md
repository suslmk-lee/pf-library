# 국립 중앙 도서관 관리 시스템 (PlugFest 2025 Demo)

Karmada + Istio 기반 멀티 클러스터 고가용성(HA) 마이크로서비스 아키텍처 시연 프로젝트

## 프로젝트 개요

이 프로젝트는 PlugFest 2025 시연을 위한 **국립 중앙 도서관 관리 시스템**입니다. 멀티 클러스터 환경(Naver, NHN)에서 한쪽 클러스터에 장애가 발생해도 사용자 세션과 대여 데이터가 유실 없이 유지되는 **Stateless HA 아키텍처**를 구현합니다.

실제 도서관 운영 방식을 반영하여, 일반 사용자는 온라인으로 도서를 검색하고 정보를 확인할 수 있으며, 실제 대여와 반납은 도서관 방문 시 관리자가 처리하는 **역할 기반 접근 제어(RBAC)** 시스템을 적용했습니다.

### 핵심 특징

- **Stateless 마이크로서비스**: 모든 백엔드 서비스는 상태를 메모리에 저장하지 않음
- **중앙 상태 관리**: MariaDB(영구 데이터), Redis(세션)를 중앙 클러스터에 배치
- **멀티 클러스터 배포**: Karmada를 통해 Naver/NHN 클러스터에 Active-Active 배포
- **서비스 메시**: Istio를 통한 트래픽 관리 및 클러스터 간 통신
- **자동 Failover**: GSLB를 통한 클러스터 장애 시 자동 트래픽 전환
- **역할 기반 접근 제어(RBAC)**: 일반 사용자와 관리자의 명확한 권한 분리
- **실제 도서관 운영 방식**: 온라인 조회 + 오프라인 대여/반납

## 아키텍처

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                        GSLB (Global Load Balancer)              │
└───────────────┬─────────────────────────┬───────────────────────┘
                │                         │
    ┌───────────▼──────────┐  ┌───────────▼──────────┐
    │   Naver Cluster      │  │   NHN Cluster        │
    │   (Member 1)         │  │   (Member 2)         │
    │                      │  │                      │
    │  ┌────────────────┐  │  │  ┌────────────────┐  │
    │  │ Istio Ingress  │  │  │  │ Istio Ingress  │  │
    │  │    Gateway     │  │  │  │    Gateway     │  │
    │  └────────┬───────┘  │  │  └────────┬───────┘  │
    │           │          │  │           │          │
    │  ┌────────▼───────┐  │  │  ┌────────▼───────┐  │
    │  │   Frontend     │  │  │  │   Frontend     │  │
    │  │   (React)      │  │  │  │   (React)      │  │
    │  └────────┬───────┘  │  │  └────────┬───────┘  │
    │           │          │  │           │          │
    │  ┌────────▼───────┐  │  │  ┌────────▼───────┐  │
    │  │  API Gateway   │  │  │  │  API Gateway   │  │
    │  └─┬──┬──┬────────┘  │  │  └─┬──┬──┬────────┘  │
    │    │  │  │           │  │    │  │  │           │
    │  ┌─▼┐┌▼┐┌▼─────┐    │  │  ┌─▼┐┌▼┐┌▼─────┐    │
    │  │U││B││Cart  │    │  │  │U││B││Cart  │    │
    │  │s││o││Svc   │    │  │  │s││o││Svc   │    │
    │  │e││o││      │    │  │  │e││o││      │    │
    │  │r││k│└──────┘    │  │  │r││k│└──────┘    │
    │  └─┘└─┘            │  │  └─┘└─┘            │
    └────────┬────────────┘  └────────┬────────────┘
             │                        │
             │         ┌──────────────┘
             │         │
    ┌────────▼─────────▼──────────────┐
    │     Central Cluster              │
    │                                  │
    │  ┌──────────┐  ┌──────────┐    │
    │  │ MariaDB  │  │  Redis   │    │
    │  │ (영구DB) │  │(세션/캐시)│    │
    │  └──────────┘  └──────────┘    │
    └──────────────────────────────────┘
```

### 서비스 구성

#### 백엔드 서비스 (Go + Gin)
1. **user-service**: 사용자 인증 및 역할 관리 (MariaDB 인증 + Redis 세션)
2. **book-service**: 도서 목록 조회 및 검색 필터링 (MariaDB)
3. **borrow-service**: 대여/반납 관리 및 이력 조회 (MariaDB, 관리자 권한 필요)
4. **api-gateway**: 단일 진입점 및 라우팅

#### 프론트엔드
- **frontend**: React + Tailwind CSS + Vite

#### 중앙 데이터 저장소
- **MariaDB**: 사용자 계정(역할 포함), 도서 카탈로그, 대여 이력 (영구 데이터)
- **Redis**: 세션 토큰 (일시적이지만 클러스터 간 공유)

## 주요 기능

### 일반 사용자 기능
- ✅ 도서 검색 및 필터링 (제목, 저자, 출판사, 연도)
- ✅ 도서 상세 정보 조회
- ✅ 내 대여 목록 확인
- ✅ 대여 이력 조회 (전체, 대여 중, 반납 완료, 연체)
- ✅ 대여 현황 통계 (대여 중, 반납 완료, 연체 건수)

### 관리자 기능
- ✅ 관리자 대시보드 (통계 및 현황)
- ✅ 전체 사용자 대여 목록 조회
- ✅ 사용자별 대여 등록 (카운터에서 수동 등록)
- ✅ 반납 처리
- ✅ 연체 도서 모니터링
- ✅ 상위 대여자 통계

## 디렉토리 구조

```
pf-library/
├── services/
│   ├── user-service/
│   │   ├── main.go
│   │   ├── go.mod
│   │   └── Dockerfile
│   ├── book-service/
│   │   ├── main.go
│   │   ├── go.mod
│   │   └── Dockerfile
│   ├── borrow-service/
│   │   ├── main.go
│   │   ├── go.mod
│   │   └── Dockerfile
│   └── api-gateway/
│       ├── main.go
│       ├── go.mod
│       └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   └── types/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/
│   ├── central/           # 중앙 클러스터용
│   │   ├── mariadb-deployment.yaml
│   │   └── redis-deployment.yaml
│   ├── karmada/           # Karmada 배포용
│   │   ├── namespace.yaml
│   │   ├── user-service.yaml
│   │   ├── book-service.yaml
│   │   ├── borrow-service.yaml
│   │   ├── api-gateway.yaml
│   │   ├── frontend.yaml
│   │   └── propagation-policy.yaml
│   └── istio/             # Istio 설정
│       ├── gateway.yaml
│       ├── virtualservice.yaml
│       ├── serviceentry.yaml
│       └── destinationrule.yaml
└── docs/
    └── DEPLOYMENT.md
```

## 빠른 시작

### 사전 요구사항

- Docker
- Kubernetes 클러스터 (3개: Central, Naver, NHN)
- Karmada 설치 및 설정
- Istio 설치 (각 멤버 클러스터)
- kubectl, karmadactl CLI 도구

### 1. 이미지 빌드 및 푸시

```bash
# 이미지 레지스트리 설정
export REGISTRY=your-registry.io/library

# 백엔드 서비스 빌드
cd services/user-service
docker build -t $REGISTRY/user-service:latest .
docker push $REGISTRY/user-service:latest

cd ../book-service
docker build -t $REGISTRY/book-service:latest .
docker push $REGISTRY/book-service:latest

cd ../borrow-service
docker build -t $REGISTRY/borrow-service:latest .
docker push $REGISTRY/borrow-service:latest

cd ../api-gateway
docker build -t $REGISTRY/api-gateway:latest .
docker push $REGISTRY/api-gateway:latest

# 프론트엔드 빌드
cd ../../frontend
npm install
docker build -t $REGISTRY/frontend:latest .
docker push $REGISTRY/frontend:latest
```

### 2. 중앙 클러스터 배포

```bash
# 중앙 클러스터 컨텍스트로 전환
kubectl config use-context central-cluster

# MariaDB 배포
kubectl apply -f k8s/central/mariadb-deployment.yaml

# Redis 배포
kubectl apply -f k8s/central/redis-deployment.yaml

# 배포 확인
kubectl get pods -n default
kubectl get svc -n default
```

### 3. Karmada를 통한 멀티 클러스터 배포

```bash
# Karmada 컨텍스트로 전환
kubectl config use-context karmada-apiserver

# 네임스페이스 생성 (istio-injection 활성화)
kubectl apply -f k8s/karmada/namespace.yaml

# 서비스 배포
kubectl apply -f k8s/karmada/user-service.yaml
kubectl apply -f k8s/karmada/book-service.yaml
kubectl apply -f k8s/karmada/borrow-service.yaml
kubectl apply -f k8s/karmada/api-gateway.yaml
kubectl apply -f k8s/karmada/frontend.yaml

# PropagationPolicy 적용
kubectl apply -f k8s/karmada/propagation-policy.yaml

# 배포 확인
kubectl get deploy -n library-system
karmadactl get deploy -n library-system
```

### 4. Istio 설정 적용

```bash
# Gateway 설정
kubectl apply -f k8s/istio/gateway.yaml

# VirtualService 설정
kubectl apply -f k8s/istio/virtualservice.yaml

# ServiceEntry 설정 (중앙 DB/Redis 접근용)
kubectl apply -f k8s/istio/serviceentry.yaml

# DestinationRule 설정
kubectl apply -f k8s/istio/destinationrule.yaml

# Istio 설정 확인
kubectl get gateway -n library-system
kubectl get virtualservice -n library-system
```

### 5. 접속 확인

```bash
# Istio Ingress Gateway 주소 확인
kubectl get svc istio-ingressgateway -n istio-system

# 브라우저로 접속
# http://<EXTERNAL-IP>/
```

## 시연 시나리오

### 시나리오 1: 일반 사용자 시연

1. **사용자 로그인**
   - 일반 사용자 계정(user/password)으로 로그인
   - Naver 클러스터를 통해 접속
   - 세션이 중앙 Redis에 저장됨

2. **도서 검색 및 조회**
   - 도서 검색 필터링 (저자, 출판사, 연도)
   - 특정 도서 상세보기
   - 대여 안내 정보 확인

3. **대여 현황 확인**
   - 내 대여 목록 확인
   - 대여 이력 조회 (전체, 대여 중, 반납 완료, 연체)
   - 통계 정보 확인

### 시나리오 2: 관리자 시연

1. **관리자 로그인**
   - 관리자 계정(admin/admin123)으로 로그인
   - 관리자 대시보드 접근

2. **대여 등록**
   - 사용자 방문 시뮬레이션
   - 특정 사용자에게 도서 대여 등록
   - 대여 기록 확인

3. **반납 처리**
   - 대여 중인 도서 목록 확인
   - 특정 대여 건에 대해 반납 처리
   - 통계 업데이트 확인

### 시나리오 3: Stateless HA 검증

1. **사용자 로그인 및 활동**
   - Naver 클러스터를 통해 로그인
   - 도서 검색 및 대여 이력 확인
   - 세션이 중앙 Redis에 저장됨

2. **클러스터 장애 시뮬레이션**
   - Naver 클러스터 다운 또는 트래픽 차단
   - GSLB가 자동으로 NHN 클러스터로 트래픽 전환

3. **세션 유지 확인**
   - 페이지 새로고침
   - 로그아웃 없이 정상 접속 확인
   - 대여 목록/이력 데이터 유실 없음 확인
   - 관리자의 경우 대시보드 접근 유지 확인

## 환경 변수

### 백엔드 서비스

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서비스 포트 | `8080` |
| `DB_HOST` | MariaDB 호스트 | `mariadb-central.default.svc.cluster.local` |
| `DB_USER` | DB 사용자 | `root` |
| `DB_PASSWORD` | DB 비밀번호 | `rootpassword` |
| `DB_NAME` | 데이터베이스 이름 | `library` |
| `REDIS_ADDR` | Redis 주소 | `redis-central.default.svc.cluster.local:6379` |

### 프론트엔드

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `VITE_API_GATEWAY_URL` | API Gateway URL | `/api` |

## 테스트 계정

| 사용자 ID | 비밀번호 | 역할 | 권한 |
|-----------|----------|------|------|
| `user` | `password` | 일반 사용자 | 도서 검색/조회, 대여 목록/이력 확인 |
| `admin` | `admin123` | 관리자 | 대시보드, 대여 등록/반납 처리, 전체 통계 |

## 트러블슈팅

### MariaDB 연결 실패
```bash
# MariaDB Pod 로그 확인
kubectl logs -n default <mariadb-pod-name>

# 연결 테스트
kubectl run -it --rm debug --image=mysql:8 --restart=Never -- \
  mysql -h mariadb-central.default.svc.cluster.local -u root -prootpassword
```

### Redis 연결 실패
```bash
# Redis Pod 로그 확인
kubectl logs -n default <redis-pod-name>

# 연결 테스트
kubectl run -it --rm debug --image=redis:7-alpine --restart=Never -- \
  redis-cli -h redis-central.default.svc.cluster.local ping
```

### Karmada 배포 확인
```bash
# 멤버 클러스터 목록
karmadactl get clusters

# 리소스 배포 상태
karmadactl get deploy -n library-system

# 특정 클러스터 확인
kubectl --context=naver get pods -n library-system
kubectl --context=nhn get pods -n library-system
```

### Istio 트래픽 확인
```bash
# Istio 프록시 상태
kubectl get pods -n library-system -o jsonpath='{.items[*].spec.containers[*].name}'

# VirtualService 상태
kubectl get virtualservice -n library-system -o yaml
```

## 성능 최적화

- **Connection Pooling**: Go 서비스의 DB/Redis 연결 풀 설정
- **Caching**: Redis를 통한 도서 목록 캐싱
- **Load Balancing**: Istio의 라운드 로빈 로드 밸런싱
- **Auto Scaling**: HPA를 통한 자동 스케일링 (선택사항)

## 보안 고려사항

- **mTLS**: Istio를 통한 서비스 간 암호화 통신
- **네트워크 정책**: Kubernetes NetworkPolicy 적용 권장
- **Secret 관리**: DB 비밀번호를 Kubernetes Secret으로 관리
- **RBAC**: 적절한 권한 관리

## 라이선스

MIT License

## 문의

PlugFest 2025 프로젝트 관련 문의사항은 이슈를 등록해주세요.
