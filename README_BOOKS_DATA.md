# 도서 데이터 관리 가이드

## 개요

이 프로젝트는 국립중앙도서관 스타일의 도서 대여 관리 시스템입니다. 현재 108권의 도서 데이터가 포함되어 있습니다.

## 도서 데이터 현황

### 카테고리별 분류
- **IT/컴퓨터**: 20권
- **문학**: 20권
- **자기계발**: 16권
- **과학**: 15권
- **역사/인문**: 15권
- **예술/취미**: 10권
- **비즈니스**: 4권
- **기타**: 8권

## 로컬 개발 환경

### 도서 데이터 추가/업데이트

```bash
# 1. 데이터베이스 접속 확인
mysql -h 0.0.0.0 -u suslmk -pmaster pf2025

# 2. 현재 도서 수 확인
mysql -h 0.0.0.0 -u suslmk -pmaster pf2025 -e "SELECT COUNT(*) FROM books;"

# 3. 샘플 데이터 추가 (100권)
cd scripts
mysql -h 0.0.0.0 -u suslmk -pmaster pf2025 < sample_books_100.sql
```

### 샘플 데이터 재생성

```bash
cd scripts
python3 generate_sample_books.py
```

## Kubernetes 환경

### 초기 데이터 설정

Kubernetes 배포 시 `k8s/central/mariadb-deployment.yaml`의 init.sql이 자동 실행되어 기본 8권의 도서가 생성됩니다.

### 추가 100권 데이터 import (고유한 이미지 포함)

**방법 1: 전체 데이터 export 파일 사용 (권장)**

```bash
# 1. MariaDB Pod 이름 확인
POD_NAME=$(kubectl get pods -n default -l app=mariadb-central -o jsonpath='{.items[0].metadata.name}')

# 2. 로컬 SQL 파일을 Pod로 복사
kubectl cp scripts/all_books_with_images.sql default/$POD_NAME:/tmp/

# 3. Pod에서 SQL 실행
kubectl exec -it $POD_NAME -n default -- \
  mysql -u root -prootpassword library < /tmp/all_books_with_images.sql

# 4. 데이터 확인
kubectl exec -it $POD_NAME -n default -- \
  mysql -u root -prootpassword library -e "SELECT COUNT(*) as total_books FROM books;"
```

**방법 2: 샘플 데이터만 사용**

```bash
# 1. MariaDB Pod 이름 확인
POD_NAME=$(kubectl get pods -n default -l app=mariadb-central -o jsonpath='{.items[0].metadata.name}')

# 2. 로컬 SQL 파일을 Pod로 복사
kubectl cp scripts/sample_books_100.sql default/$POD_NAME:/tmp/

# 3. Pod에서 SQL 실행
kubectl exec -it $POD_NAME -n default -- \
  mysql -u root -prootpassword library < /tmp/sample_books_100.sql

# 4. 이미지 URL 업데이트 (고유한 이미지로)
kubectl cp scripts/update_book_covers.sql default/$POD_NAME:/tmp/
kubectl exec -it $POD_NAME -n default -- \
  mysql -u root -prootpassword library < /tmp/update_book_covers.sql

# 5. 데이터 확인
kubectl exec -it $POD_NAME -n default -- \
  mysql -u root -prootpassword library -e "SELECT COUNT(*) as total, COUNT(DISTINCT cover_image) as unique_images FROM books;"
```

### 생성된 SQL 파일 설명

1. **all_books_with_images.sql** (권장)
   - 현재 로컬 DB의 전체 데이터 dump
   - 108권의 도서 (기본 8권 + 추가 100권)
   - 각 도서마다 고유한 Unsplash 이미지 URL 포함
   - 바로 사용 가능

2. **sample_books_100.sql**
   - 추가 100권의 샘플 데이터만
   - placehold.co 이미지 URL (작동하지 않을 수 있음)
   - update_book_covers.sql과 함께 사용 필요

3. **update_book_covers.sql**
   - 이미지 URL을 Unsplash로 업데이트
   - 각 도서에 고유한 이미지 할당

## 국립중앙도서관 Open API 사용

### API 키 발급

1. https://www.nl.go.kr/NL/contents/N31101020000.do 접속
2. API 키 신청 및 발급
3. 환경변수 설정

```bash
export API_KEY=발급받은_API_키
```

### API로 실제 도서 데이터 수집

```bash
cd scripts
python3 fetch_books_from_nl.py
```

이 스크립트는:
- 국립중앙도서관 Open API에서 실제 도서 데이터 수집
- 다양한 키워드(프로그래밍, 문학, 과학 등)로 검색
- 100권 이상의 도서 데이터 생성
- `books_from_nl_api.sql` 파일로 저장

### 수집한 데이터 적용

```bash
# 로컬 DB에 적용
mysql -h 0.0.0.0 -u suslmk -pmaster pf2025 < books_from_nl_api.sql

# 또는 Kubernetes에 적용
kubectl cp books_from_nl_api.sql default/mariadb-central-xxx:/tmp/
kubectl exec -it mariadb-central-xxx -- \
  mysql -u root -prootpassword pf2025 < /tmp/books_from_nl_api.sql
```

## API 엔드포인트

### 국립중앙도서관 Open API

- **Base URL**: `https://www.nl.go.kr/NL/search/openApi/search.do`
- **인증**: API Key 필요
- **응답 형식**: JSON 또는 XML
- **주요 파라미터**:
  - `key`: API 키 (필수)
  - `apiType`: json 또는 xml
  - `kwd`: 검색 키워드
  - `pageSize`: 페이지당 결과 수 (기본 10)
  - `pageNum`: 페이지 번호

### 요청 예시

```bash
curl "https://www.nl.go.kr/NL/search/openApi/search.do?key=YOUR_API_KEY&apiType=json&kwd=프로그래밍&pageSize=10&pageNum=1"
```

## 데이터 스키마

```sql
CREATE TABLE books (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(100) NOT NULL,
  publisher VARCHAR(100),
  year INT,
  isbn VARCHAR(20) UNIQUE,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  cover_image VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 주의사항

1. **로컬 개발**: `.env.local`에 DB 접속 정보 설정
2. **Kubernetes**: ConfigMap과 Secret으로 환경변수 관리
3. **ID 충돌**: 기존 샘플 데이터는 ID 1-8, 추가 데이터는 100부터 시작
4. **API 제한**: 국립중앙도서관 API는 한 번에 최대 500건까지 조회 가능

## 문제 해결

### 도서 데이터가 보이지 않을 때

```bash
# DB 연결 확인
mysql -h 0.0.0.0 -u suslmk -pmaster pf2025 -e "SELECT 1"

# 테이블 확인
mysql -h 0.0.0.0 -u suslmk -pmaster pf2025 -e "SHOW TABLES FROM pf2025;"

# 도서 수 확인
mysql -h 0.0.0.0 -u suslmk -pmaster pf2025 -e "SELECT COUNT(*) FROM pf2025.books;"

# 샘플 데이터 조회
mysql -h 0.0.0.0 -u suslmk -pmaster pf2025 -e "SELECT id, title, author FROM pf2025.books LIMIT 10;"
```

### 서비스 재시작

```bash
# book-service 재시작 (포트 8082)
pkill -f "book-service"
cd services/book-service && go run main.go
```

## 참고 자료

- [국립중앙도서관 Open API](https://www.nl.go.kr/NL/contents/N31101030700.do)
- [공공데이터포털 - 국립중앙도서관 소장자료](https://www.data.go.kr/data/3078981/openapi.do)
- [K-PaaS](https://k-paas.or.kr)
