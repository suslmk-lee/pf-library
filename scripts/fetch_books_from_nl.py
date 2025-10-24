#!/usr/bin/env python3
"""
국립중앙도서관 Open API를 사용하여 도서 데이터를 가져오는 스크립트

사용방법:
1. 국립중앙도서관 Open API 키 발급: https://www.nl.go.kr/NL/contents/N31101020000.do
2. API_KEY 환경변수 설정: export API_KEY=your_api_key
3. 스크립트 실행: python3 fetch_books_from_nl.py
"""

import requests
import xml.etree.ElementTree as ET
import json
import os
import urllib.parse
from typing import List, Dict

# API 설정
API_BASE_URL = "https://www.nl.go.kr/NL/search/openApi/search.do"
API_KEY = os.environ.get("API_KEY", "")

# 검색 키워드 (다양한 주제)
SEARCH_KEYWORDS = [
    "프로그래밍", "컴퓨터", "데이터베이스", "네트워크", "보안",
    "인공지능", "머신러닝", "클라우드", "Docker", "Kubernetes",
    "소설", "시집", "에세이", "역사", "철학",
    "경제", "경영", "마케팅", "자기계발", "심리학",
    "과학", "수학", "물리학", "화학", "생물학",
    "예술", "음악", "미술", "디자인", "건축"
]


def fetch_books_from_nl_api(keyword: str, page_size: int = 10, page_num: int = 1) -> List[Dict]:
    """
    국립중앙도서관 API에서 도서 데이터 가져오기

    Args:
        keyword: 검색 키워드
        page_size: 페이지당 결과 수
        page_num: 페이지 번호

    Returns:
        도서 데이터 리스트
    """
    if not API_KEY:
        print("❌ API_KEY 환경변수가 설정되지 않았습니다.")
        print("   설정 방법: export API_KEY=your_api_key")
        return []

    params = {
        "key": API_KEY,
        "apiType": "json",
        "srchTarget": "total",
        "kwd": keyword,
        "pageSize": page_size,
        "pageNum": page_num,
        "systemType": "오프라인자료",  # 오프라인 도서만
    }

    try:
        print(f"🔍 검색 중: {keyword} (페이지 {page_num})...")
        response = requests.get(API_BASE_URL, params=params, timeout=10)
        response.raise_for_status()

        # JSON 응답 파싱
        data = response.json()

        # 응답 구조 확인 (실제 API 응답에 따라 조정 필요)
        if "result" in data and isinstance(data["result"], list):
            books = data["result"]
            print(f"✅ {len(books)}건 발견")
            return books
        else:
            print(f"⚠️  검색 결과 없음")
            return []

    except requests.exceptions.RequestException as e:
        print(f"❌ API 요청 실패: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 실패: {e}")
        return []


def parse_book_data(raw_book: Dict, book_id: int) -> Dict:
    """
    API 응답 데이터를 DB 스키마에 맞게 변환

    Args:
        raw_book: API 응답 원본 데이터
        book_id: 도서 ID

    Returns:
        변환된 도서 데이터
    """
    # API 필드명은 실제 응답에 따라 조정 필요
    title = raw_book.get("title_info", "제목 없음").strip()
    author = raw_book.get("author_info", "저자 미상").strip()
    publisher = raw_book.get("pub_info", "출판사 미상").strip()
    pub_year = raw_book.get("pub_year_info", "")
    isbn = raw_book.get("isbn", "")
    description = raw_book.get("summary", "")[:500]  # 500자 제한

    # 연도 추출 (YYYY 형식)
    try:
        if pub_year and len(pub_year) >= 4:
            year = int(pub_year[:4])
        else:
            year = 2023
    except:
        year = 2023

    # 가격 (랜덤 또는 기본값)
    import random
    price = random.randint(15000, 50000)

    # 표지 이미지 (플레이스홀더)
    colors = ["4A90E2", "50C878", "E74C3C", "3498DB", "9B59B6", "F39C12", "1ABC9C", "E67E22"]
    color = random.choice(colors)
    cover_image = f"https://placehold.co/200x300/{color}/FFFFFF?text=Book+{book_id}"

    return {
        "id": str(book_id),
        "title": title[:255],  # 255자 제한
        "author": author[:100],
        "publisher": publisher[:100],
        "year": year,
        "isbn": isbn[:20] if isbn else f"ISBN-{book_id}",
        "description": description,
        "price": price,
        "cover_image": cover_image,
    }


def generate_sql_insert(books: List[Dict]) -> str:
    """
    SQL INSERT 문 생성

    Args:
        books: 도서 데이터 리스트

    Returns:
        SQL INSERT 문
    """
    sql_parts = []
    sql_parts.append("-- 국립중앙도서관 API에서 가져온 도서 데이터")
    sql_parts.append("INSERT INTO books (id, title, author, publisher, year, isbn, description, price, cover_image) VALUES")

    values = []
    for book in books:
        # SQL 인젝션 방지를 위한 이스케이프
        title = book["title"].replace("'", "''")
        author = book["author"].replace("'", "''")
        publisher = book["publisher"].replace("'", "''")
        description = book["description"].replace("'", "''")
        isbn = book["isbn"].replace("'", "''")

        value = f"  ('{book['id']}', '{title}', '{author}', '{publisher}', {book['year']}, '{isbn}', '{description}', {book['price']}, '{book['cover_image']}')"
        values.append(value)

    sql_parts.append(",\n".join(values))
    sql_parts.append("ON DUPLICATE KEY UPDATE title=title;")

    return "\n".join(sql_parts)


def main():
    """메인 실행 함수"""
    print("=" * 60)
    print("📚 국립중앙도서관 Open API 도서 데이터 수집")
    print("=" * 60)

    if not API_KEY:
        print("\n❌ API_KEY가 필요합니다!")
        print("\n사용방법:")
        print("1. https://www.nl.go.kr/NL/contents/N31101020000.do 에서 API 키 발급")
        print("2. export API_KEY=발급받은키")
        print("3. python3 fetch_books_from_nl.py\n")
        return

    all_books = []
    book_id_counter = 1000  # 기존 샘플 데이터와 중복 방지

    # 각 키워드로 검색
    for keyword in SEARCH_KEYWORDS[:10]:  # 처음 10개 키워드만 (100권 이상)
        raw_books = fetch_books_from_nl_api(keyword, page_size=10, page_num=1)

        for raw_book in raw_books:
            book_data = parse_book_data(raw_book, book_id_counter)
            all_books.append(book_data)
            book_id_counter += 1

        # 100권 이상 수집 시 중단
        if len(all_books) >= 100:
            break

    print(f"\n✅ 총 {len(all_books)}권의 도서 데이터 수집 완료")

    if all_books:
        # SQL 파일 생성
        sql_content = generate_sql_insert(all_books)
        output_file = "books_from_nl_api.sql"

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(sql_content)

        print(f"📝 SQL 파일 생성: {output_file}")
        print(f"\n사용방법:")
        print(f"  mariadb-deployment.yaml의 init.sql에 추가하거나")
        print(f"  데이터베이스에 직접 실행하세요:\n")
        print(f"  mysql -h localhost -u root -p pf2025 < {output_file}")
    else:
        print("\n⚠️  수집된 데이터가 없습니다.")


if __name__ == "__main__":
    main()
