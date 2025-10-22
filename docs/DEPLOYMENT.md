# 배포 가이드

이 문서는 중앙 도서 관리 시스템을 처음부터 배포하는 상세한 가이드입니다.

## 목차

1. [사전 준비](#사전-준비)
2. [클러스터 준비](#클러스터-준비)
3. [Karmada 설정](#karmada-설정)
4. [Istio 설정](#istio-설정)
5. [중앙 클러스터 배포](#중앙-클러스터-배포)
6. [애플리케이션 빌드](#애플리케이션-빌드)
7. [멀티 클러스터 배포](#멀티-클러스터-배포)
8. [검증 및 테스트](#검증-및-테스트)
9. [GSLB 설정](#gslb-설정)

---

## 사전 준비

### 필수 도구 설치

```bash
# kubectl 설치
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# karmadactl 설치
curl -s https://raw.githubusercontent.com/karmada-io/karmada/master/hack/install-cli.sh | bash

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Go 설치 (선택사항 - 로컬 빌드용)
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Node.js 설치 (선택사항 - 로컬 빌드용)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 환경 변수 설정

```bash
# 이미지 레지스트리
export REGISTRY=your-registry.io/library
export VERSION=v1.0.0

# 클러스터 컨텍스트
export CENTRAL_CONTEXT=central-cluster
export NAVER_CONTEXT=naver-cluster
export NHN_CONTEXT=nhn-cluster
export KARMADA_CONTEXT=karmada-apiserver
```

---

## 클러스터 준비

### 1. Kubernetes 클러스터 생성

3개의 Kubernetes 클러스터가 필요합니다:

```bash
# 중앙 클러스터
kind create cluster --name central

# Naver 멤버 클러스터
kind create cluster --name naver

# NHN 멤버 클러스터
kind create cluster --name nhn
```

### 2. 클러스터 컨텍스트 확인

```bash
kubectl config get-contexts

# 컨텍스트 이름 확인 후 환경 변수 업데이트
export CENTRAL_CONTEXT=kind-central
export NAVER_CONTEXT=kind-naver
export NHN_CONTEXT=kind-nhn
```

---

## Karmada 설정

### 1. Karmada 설치

```bash
# Karmada 컨트롤 플레인 설치 (중앙 클러스터에)
kubectl config use-context $CENTRAL_CONTEXT

# Karmada 설치 스크립트 실행
curl -s https://raw.githubusercontent.com/karmada-io/karmada/master/hack/deploy-karmada.sh | bash -s -- kind-central
```

### 2. 멤버 클러스터 등록

```bash
# Karmada 컨텍스트로 전환
kubectl config use-context karmada-apiserver

# Naver 클러스터 조인
karmadactl join naver --cluster-context=$NAVER_CONTEXT

# NHN 클러스터 조인
karmadactl join nhn --cluster-context=$NHN_CONTEXT

# 클러스터 확인
karmadactl get clusters
```

예상 출력:
```
NAME    VERSION   MODE   READY   AGE
naver   v1.27.0   Push   True    1m
nhn     v1.27.0   Push   True    1m
```

---

## Istio 설정

### 1. 각 멤버 클러스터에 Istio 설치

```bash
# Istio 다운로드
curl -L https://istio.io/downloadIstio | sh -
cd istio-1.20.0
export PATH=$PWD/bin:$PATH

# Naver 클러스터에 Istio 설치
kubectl config use-context $NAVER_CONTEXT
istioctl install --set profile=default -y

# NHN 클러스터에 Istio 설치
kubectl config use-context $NHN_CONTEXT
istioctl install --set profile=default -y

# 설치 확인
kubectl get pods -n istio-system
```

### 2. Istio 멀티 클러스터 설정 (선택사항)

```bash
# 멀티 클러스터 메시를 위한 추가 설정
# (필요시 Istio 멀티 클러스터 가이드 참조)
```

---

## 중앙 클러스터 배포

### 1. 중앙 클러스터 컨텍스트로 전환

```bash
kubectl config use-context $CENTRAL_CONTEXT
```

### 2. MariaDB 배포

```bash
# MariaDB 배포
kubectl apply -f k8s/central/mariadb-deployment.yaml

# 배포 확인
kubectl get pods -n default -l app=mariadb-central
kubectl logs -n default -l app=mariadb-central

# 서비스 확인
kubectl get svc -n default mariadb-central
```

MariaDB가 Ready 상태가 될 때까지 대기:
```bash
kubectl wait --for=condition=ready pod -l app=mariadb-central -n default --timeout=300s
```

### 3. Redis 배포

```bash
# Redis 배포
kubectl apply -f k8s/central/redis-deployment.yaml

# 배포 확인
kubectl get pods -n default -l app=redis-central
kubectl logs -n default -l app=redis-central

# 서비스 확인
kubectl get svc -n default redis-central
```

Redis가 Ready 상태가 될 때까지 대기:
```bash
kubectl wait --for=condition=ready pod -l app=redis-central -n default --timeout=300s
```

### 4. 데이터 초기화 확인

```bash
# MariaDB 접속하여 데이터 확인
kubectl run -it --rm mysql-client --image=mysql:8 --restart=Never -- \
  mysql -h mariadb-central.default.svc.cluster.local -u root -prootpassword

# MySQL 프롬프트에서
USE library;
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM books;
```

---

## 애플리케이션 빌드

### 1. 이미지 레지스트리 로그인

```bash
docker login $REGISTRY
```

### 2. 백엔드 서비스 빌드

각 서비스를 빌드하고 푸시합니다:

```bash
# User Service
cd services/user-service
docker build -t $REGISTRY/user-service:$VERSION .
docker push $REGISTRY/user-service:$VERSION
docker tag $REGISTRY/user-service:$VERSION $REGISTRY/user-service:latest
docker push $REGISTRY/user-service:latest

# Book Service
cd ../book-service
docker build -t $REGISTRY/book-service:$VERSION .
docker push $REGISTRY/book-service:$VERSION
docker tag $REGISTRY/book-service:$VERSION $REGISTRY/book-service:latest
docker push $REGISTRY/book-service:latest

# Cart Service
cd ../cart-service
docker build -t $REGISTRY/cart-service:$VERSION .
docker push $REGISTRY/cart-service:$VERSION
docker tag $REGISTRY/cart-service:$VERSION $REGISTRY/cart-service:latest
docker push $REGISTRY/cart-service:latest

# API Gateway
cd ../api-gateway
docker build -t $REGISTRY/api-gateway:$VERSION .
docker push $REGISTRY/api-gateway:$VERSION
docker tag $REGISTRY/api-gateway:$VERSION $REGISTRY/api-gateway:latest
docker push $REGISTRY/api-gateway:latest
```

### 3. 프론트엔드 빌드

```bash
cd ../../frontend

# 의존성 설치
npm install

# 프로덕션 빌드 테스트 (선택사항)
npm run build

# Docker 이미지 빌드 및 푸시
docker build -t $REGISTRY/frontend:$VERSION .
docker push $REGISTRY/frontend:$VERSION
docker tag $REGISTRY/frontend:$VERSION $REGISTRY/frontend:latest
docker push $REGISTRY/frontend:latest
```

### 4. 이미지 확인

```bash
# 모든 이미지가 푸시되었는지 확인
docker images | grep $REGISTRY
```

### 5. Manifest 이미지 경로 업데이트

```bash
# k8s/karmada/*.yaml 파일의 이미지 경로를 실제 레지스트리로 변경
cd ../../k8s/karmada
sed -i "s|your-registry|$REGISTRY|g" *.yaml
```

---

## 멀티 클러스터 배포

### 1. Karmada 컨텍스트로 전환

```bash
kubectl config use-context $KARMADA_CONTEXT
```

### 2. 네임스페이스 생성

```bash
kubectl apply -f k8s/karmada/namespace.yaml

# 확인
kubectl get namespace library-system
```

### 3. 애플리케이션 배포

```bash
# 모든 서비스 배포
kubectl apply -f k8s/karmada/user-service.yaml
kubectl apply -f k8s/karmada/book-service.yaml
kubectl apply -f k8s/karmada/cart-service.yaml
kubectl apply -f k8s/karmada/api-gateway.yaml
kubectl apply -f k8s/karmada/frontend.yaml

# 배포 확인
kubectl get deploy -n library-system
kubectl get svc -n library-system
```

### 4. PropagationPolicy 적용

```bash
kubectl apply -f k8s/karmada/propagation-policy.yaml

# 전파 상태 확인
kubectl get propagationpolicy -n library-system

# 리소스가 멤버 클러스터에 전파되었는지 확인
karmadactl get deploy -n library-system
```

### 5. 멤버 클러스터에서 직접 확인

```bash
# Naver 클러스터
kubectl --context=$NAVER_CONTEXT get pods -n library-system
kubectl --context=$NAVER_CONTEXT get svc -n library-system

# NHN 클러스터
kubectl --context=$NHN_CONTEXT get pods -n library-system
kubectl --context=$NHN_CONTEXT get svc -n library-system
```

모든 Pod가 Running 상태가 될 때까지 대기:
```bash
kubectl --context=$NAVER_CONTEXT wait --for=condition=ready pod --all -n library-system --timeout=600s
kubectl --context=$NHN_CONTEXT wait --for=condition=ready pod --all -n library-system --timeout=600s
```

### 6. Istio 설정 적용

Istio 리소스는 각 멤버 클러스터에 개별 적용합니다:

```bash
# Naver 클러스터
kubectl --context=$NAVER_CONTEXT apply -f k8s/istio/gateway.yaml
kubectl --context=$NAVER_CONTEXT apply -f k8s/istio/virtualservice.yaml
kubectl --context=$NAVER_CONTEXT apply -f k8s/istio/serviceentry.yaml
kubectl --context=$NAVER_CONTEXT apply -f k8s/istio/destinationrule.yaml

# NHN 클러스터
kubectl --context=$NHN_CONTEXT apply -f k8s/istio/gateway.yaml
kubectl --context=$NHN_CONTEXT apply -f k8s/istio/virtualservice.yaml
kubectl --context=$NHN_CONTEXT apply -f k8s/istio/serviceentry.yaml
kubectl --context=$NHN_CONTEXT apply -f k8s/istio/destinationrule.yaml
```

### 7. ServiceEntry IP 수정 (중요)

ServiceEntry의 주소를 중앙 클러스터의 실제 서비스 IP로 변경해야 합니다:

```bash
# 중앙 클러스터의 서비스 IP 확인
kubectl --context=$CENTRAL_CONTEXT get svc -n default mariadb-central -o jsonpath='{.spec.clusterIP}'
kubectl --context=$CENTRAL_CONTEXT get svc -n default redis-central -o jsonpath='{.spec.clusterIP}'

# 또는 외부 접근 가능한 LoadBalancer/NodePort 사용
# 실제 환경에서는 DNS 또는 고정 IP 사용 권장
```

---

## 검증 및 테스트

### 1. Istio Ingress Gateway 접속 정보 확인

```bash
# Naver 클러스터
export NAVER_INGRESS_HOST=$(kubectl --context=$NAVER_CONTEXT get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Naver Ingress: http://$NAVER_INGRESS_HOST"

# NHN 클러스터
export NHN_INGRESS_HOST=$(kubectl --context=$NHN_CONTEXT get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "NHN Ingress: http://$NHN_INGRESS_HOST"
```

LoadBalancer가 없는 경우 (Kind 등):
```bash
# Port-forward 사용
kubectl --context=$NAVER_CONTEXT port-forward -n istio-system svc/istio-ingressgateway 8080:80
# http://localhost:8080 접속
```

### 2. 기능 테스트

#### 로그인 테스트
```bash
curl -X POST http://$NAVER_INGRESS_HOST/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"id":"user","password":"password"}'
```

예상 응답:
```json
{
  "token": "uuid-token",
  "user_id": "1"
}
```

#### 도서 목록 조회
```bash
curl http://$NAVER_INGRESS_HOST/api/books/books
```

#### 장바구니 추가 (토큰 필요)
```bash
export TOKEN="your-token-from-login"

curl -X POST http://$NAVER_INGRESS_HOST/api/cart/cart/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"book_id":"1","title":"Kubernetes 완벽 가이드","author":"김정현","price":38000,"cover_image":""}'
```

#### 장바구니 조회
```bash
curl http://$NAVER_INGRESS_HOST/api/cart/cart \
  -H "Authorization: Bearer $TOKEN"
```

### 3. 브라우저 테스트

1. 브라우저에서 `http://$NAVER_INGRESS_HOST` 접속
2. 로그인 (user / password)
3. 도서 목록에서 책 담기
4. 장바구니 확인

### 4. Failover 테스트

```bash
# 1. Naver 클러스터에서 로그인 및 장바구니 추가
# (위 테스트 수행)

# 2. Naver 클러스터의 Pod 삭제 (장애 시뮬레이션)
kubectl --context=$NAVER_CONTEXT delete pods --all -n library-system

# 3. NHN 클러스터에서 동일한 토큰으로 장바구니 조회
curl http://$NHN_INGRESS_HOST/api/cart/cart \
  -H "Authorization: Bearer $TOKEN"

# 4. 장바구니 데이터가 유지되는지 확인
```

---

## GSLB 설정

GSLB(Global Server Load Balancing) 설정은 사용하는 DNS/로드밸런서에 따라 다릅니다.

### AWS Route 53 예시

```bash
# Route 53에서 Health Check 생성
# - Naver Ingress: http://$NAVER_INGRESS_HOST/health
# - NHN Ingress: http://$NHN_INGRESS_HOST/health

# Weighted Routing Policy 또는 Failover Routing Policy 설정
# - Primary: Naver Cluster
# - Secondary: NHN Cluster
```

### F5 BIG-IP DNS (GTM) 예시

```bash
# GTM에서 Pool 생성
# - Pool 1: Naver Ingress
# - Pool 2: NHN Ingress

# Wide IP 생성
# - gslb.plugfest2025.com
# - Load Balancing Method: Round Robin 또는 Ratio
```

### 테스트용 로컬 설정

```bash
# /etc/hosts에 추가
echo "$NAVER_INGRESS_HOST library.local" | sudo tee -a /etc/hosts

# 브라우저에서 http://library.local 접속
```

---

## 모니터링 및 로깅

### 1. Istio 대시보드

```bash
# Kiali 설치 (Istio 시각화)
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml

# Kiali 접속
istioctl dashboard kiali
```

### 2. 로그 확인

```bash
# 특정 서비스 로그
kubectl --context=$NAVER_CONTEXT logs -n library-system -l app=user-service -f

# 모든 서비스 로그
kubectl --context=$NAVER_CONTEXT logs -n library-system --all-containers=true -f
```

### 3. 메트릭 확인

```bash
# Prometheus 설치
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml

# Grafana 설치
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/grafana.yaml

# Grafana 접속
istioctl dashboard grafana
```

---

## 정리 (Clean Up)

```bash
# 애플리케이션 삭제
kubectl --context=$KARMADA_CONTEXT delete -f k8s/karmada/
kubectl --context=$NAVER_CONTEXT delete -f k8s/istio/
kubectl --context=$NHN_CONTEXT delete -f k8s/istio/

# 중앙 클러스터 리소스 삭제
kubectl --context=$CENTRAL_CONTEXT delete -f k8s/central/

# 네임스페이스 삭제
kubectl --context=$KARMADA_CONTEXT delete namespace library-system
kubectl --context=$CENTRAL_CONTEXT delete namespace default --cascade=foreground

# 클러스터 삭제 (Kind 사용 시)
kind delete cluster --name central
kind delete cluster --name naver
kind delete cluster --name nhn
```

---

## 문제 해결

### Pod가 시작되지 않는 경우

```bash
kubectl --context=$NAVER_CONTEXT describe pod <pod-name> -n library-system
kubectl --context=$NAVER_CONTEXT logs <pod-name> -n library-system
```

### 이미지 Pull 실패

```bash
# ImagePullSecret 생성
kubectl --context=$NAVER_CONTEXT create secret docker-registry regcred \
  --docker-server=$REGISTRY \
  --docker-username=<username> \
  --docker-password=<password> \
  -n library-system

# Deployment에 imagePullSecrets 추가
```

### DB/Redis 연결 실패

```bash
# 중앙 클러스터에서 서비스 확인
kubectl --context=$CENTRAL_CONTEXT get svc -n default

# 멤버 클러스터에서 연결 테스트
kubectl --context=$NAVER_CONTEXT run -it --rm debug --image=mysql:8 --restart=Never -- \
  mysql -h <mariadb-ip> -u root -prootpassword
```

### Istio Sidecar 주입 안 됨

```bash
# 네임스페이스 레이블 확인
kubectl --context=$NAVER_CONTEXT get namespace library-system --show-labels

# 레이블 추가
kubectl --context=$NAVER_CONTEXT label namespace library-system istio-injection=enabled

# Pod 재시작
kubectl --context=$NAVER_CONTEXT rollout restart deployment -n library-system
```

---

## 다음 단계

- [ ] TLS 인증서 설정 (Let's Encrypt)
- [ ] HorizontalPodAutoscaler 설정
- [ ] Prometheus + Grafana 대시보드 커스터마이징
- [ ] CI/CD 파이프라인 구축 (GitHub Actions, ArgoCD)
- [ ] Backup & Restore 전략 수립

---

**배포 완료!** 시스템이 정상적으로 작동하는지 확인하고 PlugFest 2025 시연을 준비하세요.
