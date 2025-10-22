# 아키텍처 문서

## 시스템 개요

중앙 도서 관리 시스템은 PlugFest 2025 시연을 위해 설계된 **Stateless HA 마이크로서비스 아키텍처**입니다. Karmada와 Istio를 활용하여 멀티 클러스터 환경에서 고가용성을 보장합니다.

## 핵심 설계 원칙

### 1. Stateless 아키텍처

모든 애플리케이션 서비스는 상태를 메모리에 저장하지 않습니다:

- **세션 정보**: Redis에 중앙 저장
- **장바구니 데이터**: Redis에 중앙 저장
- **사용자 데이터**: MariaDB에 중앙 저장
- **도서 카탈로그**: MariaDB에 중앙 저장

이를 통해 어떤 클러스터의 어떤 인스턴스가 요청을 처리하더라도 동일한 결과를 보장합니다.

### 2. 멀티 클러스터 배포

Karmada를 통해 애플리케이션 서비스를 여러 클러스터에 자동 배포:

```
Karmada Control Plane
    │
    ├─> Naver Cluster (Member 1)
    │   └─> 모든 애플리케이션 서비스 (1/2 replica)
    │
    └─> NHN Cluster (Member 2)
        └─> 모든 애플리케이션 서비스 (1/2 replica)
```

### 3. 중앙 데이터 저장소

MariaDB와 Redis는 별도의 중앙 클러스터에 배치:

- **안정성**: 애플리케이션 장애와 독립적
- **일관성**: 단일 데이터 소스
- **성능**: 영구 스토리지와 캐시 분리

## 서비스 아키텍처

### 마이크로서비스 구성

```
┌─────────────┐
│  Frontend   │  React SPA (정적 파일 서빙)
└──────┬──────┘
       │
┌──────▼────────┐
│ API Gateway   │  라우팅 및 프록시
└─┬───┬───┬─────┘
  │   │   │
┌─▼┐ ┌▼┐ ┌▼──────┐
│U │ │B│ │Cart   │  비즈니스 로직
│s │ │o│ │Service│
│e │ │o│ └───┬───┘
│r │ │k│     │
└─┬┘ └┬┘     │
  │   │      │
┌─▼───▼──────▼─┐
│  MariaDB     │  영구 데이터
└──────────────┘
┌──────────────┐
│    Redis     │  세션/캐시
└──────────────┘
```

### 서비스별 책임

#### user-service
- **책임**: 사용자 인증 및 세션 관리
- **의존성**: MariaDB (사용자 계정), Redis (세션 토큰)
- **API**:
  - `POST /login`: 로그인
  - `POST /logout`: 로그아웃

#### book-service
- **책임**: 도서 카탈로그 조회
- **의존성**: MariaDB (도서 정보)
- **API**:
  - `GET /books`: 전체 도서 목록
  - `GET /books/:id`: 특정 도서 조회

#### cart-service
- **책임**: 장바구니 관리
- **의존성**: Redis (장바구니 데이터)
- **API**:
  - `GET /cart`: 장바구니 조회
  - `POST /cart/add`: 도서 추가
  - `DELETE /cart/remove/:id`: 도서 제거
  - `POST /cart/clear`: 장바구니 비우기

#### api-gateway
- **책임**: 단일 진입점, 라우팅
- **의존성**: 다른 모든 마이크로서비스
- **라우팅 규칙**:
  - `/api/users/*` → user-service
  - `/api/books/*` → book-service
  - `/api/cart/*` → cart-service

#### frontend
- **책임**: 사용자 인터페이스
- **의존성**: api-gateway
- **페이지**:
  - `/login`: 로그인
  - `/books`: 도서 목록
  - `/cart`: 장바구니

## 데이터 플로우

### 로그인 플로우

```
1. 사용자 → Frontend: 로그인 폼 제출
2. Frontend → API Gateway: POST /api/users/login
3. API Gateway → User Service: POST /login
4. User Service → MariaDB: 사용자 조회
5. MariaDB → User Service: 사용자 정보 반환
6. User Service: 토큰 생성
7. User Service → Redis: 세션 저장 (session:token → user_id)
8. User Service → API Gateway: 토큰 반환
9. API Gateway → Frontend: 토큰 반환
10. Frontend: localStorage에 토큰 저장
```

### 장바구니 추가 플로우

```
1. 사용자 → Frontend: "담기" 버튼 클릭
2. Frontend → API Gateway: POST /api/cart/cart/add (+ Authorization)
3. API Gateway → Cart Service: POST /cart/add
4. Cart Service → Redis: GET session:token
5. Redis → Cart Service: user_id 반환
6. Cart Service → Redis: GET cart:user_id
7. Redis → Cart Service: 기존 장바구니 반환
8. Cart Service: 장바구니에 도서 추가
9. Cart Service → Redis: SET cart:user_id (업데이트된 장바구니)
10. Cart Service → API Gateway: 성공 응답
11. API Gateway → Frontend: 성공 응답
```

### Failover 시나리오

```
초기 상태:
- 사용자가 Naver 클러스터에서 로그인 (세션: Redis)
- 장바구니에 도서 추가 (데이터: Redis)

장애 발생:
- Naver 클러스터 다운
- GSLB가 트래픽을 NHN 클러스터로 전환

복구 상태:
- 사용자가 NHN 클러스터에 접속
- 동일한 토큰으로 요청
- NHN의 Cart Service → 중앙 Redis 조회
- 장바구니 데이터 정상 조회 (데이터 유실 없음)
```

## 네트워크 아키텍처

### Istio 서비스 메시

```
┌─────────────────────────────────────────┐
│         Istio Ingress Gateway           │
│  - GSLB로부터 트래픽 수신                │
│  - HTTP/HTTPS 라우팅                     │
└────────────────┬────────────────────────┘
                 │
         ┌───────▼────────┐
         │  VirtualService │
         │  - /api/* → API Gateway
         │  - /* → Frontend
         └───────┬─────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐   ┌───▼───┐   ┌───▼────┐
│ Svc 1 │   │ Svc 2 │   │ Svc 3  │
│       │   │       │   │        │
│ mTLS  │   │ mTLS  │   │ mTLS   │
└───────┘   └───────┘   └────────┘
```

### 외부 서비스 접근 (ServiceEntry)

멤버 클러스터에서 중앙 클러스터의 DB/Redis 접근:

```
Member Cluster Pod
    │
    ├─> Istio Sidecar (Envoy)
    │       │
    │       └─> ServiceEntry (mariadb-central)
    │               │
    │               └─> Central Cluster: MariaDB
    │
    └─> Istio Sidecar (Envoy)
            │
            └─> ServiceEntry (redis-central)
                    │
                    └─> Central Cluster: Redis
```

## 보안 아키텍처

### 1. 서비스 간 통신 (mTLS)

Istio가 자동으로 서비스 간 mTLS 적용:

```yaml
trafficPolicy:
  tls:
    mode: ISTIO_MUTUAL
```

### 2. 인증 및 인가

- **세션 기반 인증**: JWT 대신 UUID 토큰 사용 (시연용 단순화)
- **토큰 검증**: 모든 보호된 엔드포인트에서 Redis 세션 확인
- **CORS**: 모든 서비스에서 CORS 헤더 설정

### 3. 네트워크 격리

- **네임스페이스 분리**: `library-system` 네임스페이스에 애플리케이션 격리
- **서비스 메시**: Istio를 통한 트래픽 제어

## 확장성 및 성능

### 수평 확장

Karmada PropagationPolicy를 통한 자동 배포:

```yaml
replicaScheduling:
  replicaDivisionPreference: Weighted
  replicaSchedulingType: Divided
  weightPreference:
    staticWeightList:
    - targetCluster:
        clusterNames: [naver]
      weight: 1
    - targetCluster:
        clusterNames: [nhn]
      weight: 1
```

- 각 클러스터에 균등하게 replica 배포
- HPA 추가 시 각 클러스터에서 독립적으로 스케일링 가능

### 성능 최적화

1. **Redis 캐싱**: 자주 조회되는 데이터 캐싱
2. **Connection Pooling**: Go의 DB/Redis 연결 풀
3. **Istio Circuit Breaking**: 장애 전파 방지
4. **Load Balancing**: 라운드 로빈 로드 밸런싱

## 모니터링 및 관측성

### Istio 텔레메트리

- **Metrics**: Prometheus를 통한 메트릭 수집
- **Tracing**: Jaeger를 통한 분산 추적
- **Logging**: 각 서비스의 구조화된 로깅

### 권장 대시보드

1. **Kiali**: 서비스 메시 시각화
2. **Grafana**: 메트릭 대시보드
3. **Jaeger UI**: 요청 추적

## 장애 복구

### 자동 복구 메커니즘

1. **Pod 재시작**: Kubernetes의 자동 재시작
2. **Health Check**: Liveness/Readiness Probe
3. **Circuit Breaking**: Istio의 회로 차단
4. **Retry**: Istio의 자동 재시도

### 수동 복구 절차

1. **DB 복구**: PVC를 통한 영구 스토리지 보호
2. **Redis 복구**: AOF를 통한 데이터 복구
3. **서비스 롤백**: `kubectl rollout undo` 사용

## 제한 사항 및 개선 사항

### 현재 제한 사항

1. **단일 DB/Redis**: 중앙 저장소가 SPOF (Single Point of Failure)
2. **단순 인증**: 프로덕션에서는 JWT 또는 OAuth2 권장
3. **평문 비밀번호**: 실제 환경에서는 bcrypt 등 사용 필요

### 향후 개선 사항

1. **DB 고가용성**: MariaDB Galera Cluster 또는 Master-Slave 복제
2. **Redis 고가용성**: Redis Sentinel 또는 Redis Cluster
3. **Secret 관리**: HashiCorp Vault 또는 Sealed Secrets
4. **CI/CD**: GitHub Actions + ArgoCD 파이프라인
5. **Rate Limiting**: Istio 또는 API Gateway 레벨에서 처리

## 참고 자료

- [Karmada Documentation](https://karmada.io/docs/)
- [Istio Documentation](https://istio.io/latest/docs/)
- [Gin Web Framework](https://gin-gonic.com/docs/)
- [React Documentation](https://react.dev/)
- [MariaDB Documentation](https://mariadb.com/kb/)
- [Redis Documentation](https://redis.io/documentation)
