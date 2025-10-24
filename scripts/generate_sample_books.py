#!/usr/bin/env python3
"""
도서관 샘플 도서 데이터 100권 생성 스크립트
국립중앙도서관 스타일의 다양한 장르 도서 데이터
"""

import random

# 도서 데이터 템플릿
BOOKS_DATA = [
    # IT/컴퓨터 (20권)
    {"title": "클린 코드", "author": "로버트 C. 마틴", "publisher": "인사이트", "year": 2013, "category": "IT"},
    {"title": "리팩토링 2판", "author": "마틴 파울러", "publisher": "한빛미디어", "year": 2020, "category": "IT"},
    {"title": "도메인 주도 설계", "author": "에릭 에반스", "publisher": "위키북스", "year": 2011, "category": "IT"},
    {"title": "실용주의 프로그래머", "author": "데이비드 토머스", "publisher": "인사이트", "year": 2014, "category": "IT"},
    {"title": "HTTP 완벽 가이드", "author": "데이빗 고울리", "publisher": "인사이트", "year": 2014, "category": "IT"},
    {"title": "자바의 정석", "author": "남궁성", "publisher": "도우출판", "year": 2022, "category": "IT"},
    {"title": "파이썬 코딩의 기술", "author": "브렛 슬라킨", "publisher": "길벗", "year": 2020, "category": "IT"},
    {"title": "모던 자바 인 액션", "author": "라울-게이브리얼 우르마", "publisher": "한빛미디어", "year": 2019, "category": "IT"},
    {"title": "이펙티브 자바", "author": "조슈아 블로크", "publisher": "인사이트", "year": 2018, "category": "IT"},
    {"title": "헤드 퍼스트 디자인 패턴", "author": "에릭 프리먼", "publisher": "한빛미디어", "year": 2022, "category": "IT"},
    {"title": "그림으로 배우는 HTTP & Network", "author": "우에노 센", "publisher": "영진닷컴", "year": 2015, "category": "IT"},
    {"title": "코딩 인터뷰 완전 분석", "author": "게일 라크만 맥도웰", "publisher": "프로그래밍인사이트", "year": 2017, "category": "IT"},
    {"title": "객체지향의 사실과 오해", "author": "조영호", "publisher": "위키북스", "year": 2015, "category": "IT"},
    {"title": "클린 아키텍처", "author": "로버트 C. 마틴", "publisher": "인사이트", "year": 2019, "category": "IT"},
    {"title": "러닝 TypeScript", "author": "조시 골드버그", "publisher": "한빛미디어", "year": 2023, "category": "IT"},
    {"title": "스프링 부트와 AWS로 혼자 구현하는 웹 서비스", "author": "이동욱", "publisher": "프리렉", "year": 2019, "category": "IT"},
    {"title": "MySQL 퍼포먼스 최적화", "author": "이성욱", "publisher": "위키북스", "year": 2021, "category": "IT"},
    {"title": "알고리즘 문제 해결 전략", "author": "구종만", "publisher": "인사이트", "year": 2012, "category": "IT"},
    {"title": "프로그래머의 뇌", "author": "펠리너 허먼스", "publisher": "제이펍", "year": 2022, "category": "IT"},
    {"title": "개발자 원칙", "author": "김민준", "publisher": "골든래빗", "year": 2023, "category": "IT"},

    # 문학 (20권)
    {"title": "82년생 김지영", "author": "조남주", "publisher": "민음사", "year": 2016, "category": "문학"},
    {"title": "채식주의자", "author": "한강", "publisher": "창비", "year": 2007, "category": "문학"},
    {"title": "아몬드", "author": "손원평", "publisher": "창비", "year": 2017, "category": "문학"},
    {"title": "달러구트 꿈 백화점", "author": "이미예", "publisher": "팩토리나인", "year": 2020, "category": "문학"},
    {"title": "트렌디 한남동", "author": "박상영", "publisher": "창비", "year": 2018, "category": "문학"},
    {"title": "죽은 시인의 사회", "author": "N.H. 클라인바움", "publisher": "영림카디널", "year": 2010, "category": "문학"},
    {"title": "데미안", "author": "헤르만 헤세", "publisher": "민음사", "year": 2000, "category": "문학"},
    {"title": "1984", "author": "조지 오웰", "publisher": "민음사", "year": 2003, "category": "문학"},
    {"title": "참을 수 없는 존재의 가벼움", "author": "밀란 쿤데라", "publisher": "민음사", "year": 1998, "category": "문학"},
    {"title": "멋진 신세계", "author": "올더스 헉슬리", "publisher": "소담출판사", "year": 2015, "category": "문학"},
    {"title": "백년의 고독", "author": "가브리엘 가르시아 마르케스", "publisher": "민음사", "year": 1995, "category": "문학"},
    {"title": "노르웨이의 숲", "author": "무라카미 하루키", "publisher": "문학사상", "year": 2012, "category": "문학"},
    {"title": "호밀밭의 파수꾼", "author": "J.D. 샐린저", "publisher": "민음사", "year": 2001, "category": "문학"},
    {"title": "위대한 개츠비", "author": "F. 스콧 피츠제럴드", "publisher": "문학동네", "year": 2013, "category": "문학"},
    {"title": "어린 왕자", "author": "생텍쥐페리", "publisher": "문학동네", "year": 2007, "category": "문학"},
    {"title": "파친코", "author": "이민진", "publisher": "문학사상", "year": 2018, "category": "문학"},
    {"title": "지금 알고 있는 걸 그때도 알았더라면", "author": "류시화", "publisher": "연금술사", "year": 2013, "category": "문학"},
    {"title": "살인자의 기억법", "author": "김영하", "publisher": "문학동네", "year": 2013, "category": "문학"},
    {"title": "나미야 잡화점의 기적", "author": "히가시노 게이고", "publisher": "현대문학", "year": 2012, "category": "문학"},
    {"title": "연금술사", "author": "파울로 코엘료", "publisher": "문학동네", "year": 2001, "category": "문학"},

    # 자기계발/비즈니스 (20권)
    {"title": "아주 작은 습관의 힘", "author": "제임스 클리어", "publisher": "비즈니스북스", "year": 2019, "category": "자기계발"},
    {"title": "데일 카네기 인간관계론", "author": "데일 카네기", "publisher": "현대지성", "year": 2019, "category": "자기계발"},
    {"title": "미라클 모닝", "author": "할 엘로드", "publisher": "한빛비즈", "year": 2016, "category": "자기계발"},
    {"title": "부의 추월차선", "author": "엠제이 드마코", "publisher": "토트", "year": 2013, "category": "자기계발"},
    {"title": "생각에 관한 생각", "author": "대니얼 카너먼", "publisher": "김영사", "year": 2012, "category": "자기계발"},
    {"title": "타이탄의 도구들", "author": "팀 페리스", "publisher": "토네이도", "year": 2017, "category": "자기계발"},
    {"title": "그릿", "author": "앤절라 더크워스", "publisher": "비즈니스북스", "year": 2016, "category": "자기계발"},
    {"title": "넛지", "author": "리처드 탈러", "publisher": "리더스북", "year": 2009, "category": "자기계발"},
    {"title": "린 스타트업", "author": "에릭 리스", "publisher": "인사이트", "year": 2012, "category": "비즈니스"},
    {"title": "제로 투 원", "author": "피터 틸", "publisher": "한국경제신문", "year": 2014, "category": "비즈니스"},
    {"title": "하버드 상위 1%의 비밀", "author": "정주영", "publisher": "한빛비즈", "year": 2018, "category": "자기계발"},
    {"title": "1만 시간의 재발견", "author": "안드레아스 에릭슨", "publisher": "비즈니스북스", "year": 2016, "category": "자기계발"},
    {"title": "월든", "author": "헨리 데이비드 소로우", "publisher": "은행나무", "year": 2011, "category": "자기계발"},
    {"title": "이기는 습관", "author": "정철우", "publisher": "갤리온", "year": 2020, "category": "자기계발"},
    {"title": "나는 4시간만 일한다", "author": "팀 페리스", "publisher": "토네이도", "year": 2015, "category": "자기계발"},
    {"title": "좋은 기업을 넘어 위대한 기업으로", "author": "짐 콜린스", "publisher": "김영사", "year": 2002, "category": "비즈니스"},
    {"title": "몰입", "author": "미하이 칙센트미하이", "publisher": "한울림", "year": 2004, "category": "자기계발"},
    {"title": "어떻게 살 것인가", "author": "유시민", "publisher": "생각의길", "year": 2013, "category": "자기계발"},
    {"title": "OKR", "author": "존 도어", "publisher": "세종서적", "year": 2019, "category": "비즈니스"},
    {"title": "아침형 인간", "author": "사이토 히로시", "publisher": "토네이도", "year": 2009, "category": "자기계발"},

    # 역사/인문 (15권)
    {"title": "사피엔스", "author": "유발 하라리", "publisher": "김영사", "year": 2015, "category": "역사"},
    {"title": "총 균 쇠", "author": "재레드 다이아몬드", "publisher": "문학사상", "year": 2005, "category": "역사"},
    {"title": "21세기를 위한 21가지 제언", "author": "유발 하라리", "publisher": "김영사", "year": 2018, "category": "인문"},
    {"title": "팩트풀니스", "author": "한스 로슬링", "publisher": "김영사", "year": 2019, "category": "인문"},
    {"title": "역사란 무엇인가", "author": "E.H. 카", "publisher": "까치", "year": 2015, "category": "역사"},
    {"title": "국가란 무엇인가", "author": "유시민", "publisher": "돌베개", "year": 2011, "category": "인문"},
    {"title": "한국사", "author": "한영우", "publisher": "경세원", "year": 2017, "category": "역사"},
    {"title": "조선왕조실록", "author": "박영규", "publisher": "들녘", "year": 2016, "category": "역사"},
    {"title": "난중일기", "author": "이순신", "publisher": "민음사", "year": 2010, "category": "역사"},
    {"title": "정의란 무엇인가", "author": "마이클 샌델", "publisher": "김영사", "year": 2010, "category": "인문"},
    {"title": "군주론", "author": "니콜로 마키아벨리", "publisher": "을유문화사", "year": 2015, "category": "인문"},
    {"title": "국부론", "author": "애덤 스미스", "publisher": "비봉출판사", "year": 2007, "category": "인문"},
    {"title": "문명의 붕괴", "author": "재레드 다이아몬드", "publisher": "김영사", "year": 2005, "category": "역사"},
    {"title": "나의 문화유산답사기", "author": "유홍준", "publisher": "창비", "year": 1993, "category": "역사"},
    {"title": "인간 불평등 기원론", "author": "장 자크 루소", "publisher": "책세상", "year": 2003, "category": "인문"},

    # 과학 (15권)
    {"title": "코스모스", "author": "칼 세이건", "publisher": "사이언스북스", "year": 2006, "category": "과학"},
    {"title": "이기적 유전자", "author": "리처드 도킨스", "publisher": "을유문화사", "year": 2010, "category": "과학"},
    {"title": "시간의 역사", "author": "스티븐 호킹", "publisher": "까치", "year": 1998, "category": "과학"},
    {"title": "엔트로피", "author": "제러미 리프킨", "publisher": "세종연구원", "year": 2000, "category": "과학"},
    {"title": "이중나선", "author": "제임스 왓슨", "publisher": "궁리", "year": 2006, "category": "과학"},
    {"title": "페르마의 마지막 정리", "author": "사이먼 싱", "publisher": "영림카디널", "year": 2014, "category": "과학"},
    {"title": "괴델, 에셔, 바흐", "author": "더글러스 호프스태터", "publisher": "까치", "year": 1999, "category": "과학"},
    {"title": "엘러건트 유니버스", "author": "브라이언 그린", "publisher": "승산", "year": 2002, "category": "과학"},
    {"title": "숨결이 바람 될 때", "author": "폴 칼라니티", "publisher": "흐름출판", "year": 2016, "category": "과학"},
    {"title": "침묵의 봄", "author": "레이첼 카슨", "publisher": "에코리브르", "year": 2011, "category": "과학"},
    {"title": "빅뱅 우주론", "author": "사이먼 싱", "publisher": "영림카디널", "year": 2005, "category": "과학"},
    {"title": "파인만의 여섯 가지 물리 이야기", "author": "리처드 파인만", "publisher": "승산", "year": 2003, "category": "과학"},
    {"title": "만들어진 신", "author": "리처드 도킨스", "publisher": "김영사", "year": 2007, "category": "과학"},
    {"title": "총명한 물리학", "author": "김범준", "publisher": "동아시아", "year": 2015, "category": "과학"},
    {"title": "세상물정의 물리학", "author": "김범준", "publisher": "동아시아", "year": 2015, "category": "과학"},

    # 예술/취미 (10권)
    {"title": "서양미술사", "author": "E.H. 곰브리치", "publisher": "예경", "year": 2003, "category": "예술"},
    {"title": "하루 5분 그림 읽기의 힘", "author": "김영숙", "publisher": "빅피시", "year": 2020, "category": "예술"},
    {"title": "클래식 수첩", "author": "김인영", "publisher": "펜타그램", "year": 2019, "category": "예술"},
    {"title": "사진의 역사", "author": "발터 벤야민", "publisher": "길", "year": 2007, "category": "예술"},
    {"title": "음악의 기쁨", "author": "레너드 번스타인", "publisher": "치읓", "year": 2019, "category": "예술"},
    {"title": "디자인 불변의 법칙 125", "author": "윌리엄 리드웰", "publisher": "디자인하우스", "year": 2007, "category": "예술"},
    {"title": "영화, 시간을 거스르다", "author": "정성일", "publisher": "문학동네", "year": 2013, "category": "예술"},
    {"title": "예술가의 방", "author": "모니카 보예", "publisher": "미술문화", "year": 2016, "category": "예술"},
    {"title": "건축, 음악처럼 듣고 미술처럼 보다", "author": "서현", "publisher": "효형출판", "year": 2007, "category": "예술"},
    {"title": "색채의 미학", "author": "요하네스 이텐", "publisher": "지구문화사", "year": 2002, "category": "예술"},
]


def generate_sql():
    """SQL INSERT 문 생성"""
    colors = ["4A90E2", "50C878", "E74C3C", "3498DB", "9B59B6", "F39C12", "1ABC9C", "E67E22",
              "E91E63", "00BCD4", "FF5722", "795548", "607D8B", "FF9800"]

    sql_lines = []
    sql_lines.append("-- 샘플 도서 데이터 100권 (국립중앙도서관 스타일)")
    sql_lines.append("INSERT INTO books (id, title, author, publisher, year, isbn, description, price, cover_image) VALUES")

    values = []
    for idx, book in enumerate(BOOKS_DATA, start=100):
        book_id = idx
        title = book["title"].replace("'", "''")
        author = book["author"].replace("'", "''")
        publisher = book["publisher"].replace("'", "''")
        year = book["year"]
        isbn = f"978-89-{random.randint(10000, 99999)}-{random.randint(100, 999)}-{random.randint(0, 9)}"
        description = f"{book['category']} 분야의 대표작. {title}은(는) {author}의 저서로, {publisher}에서 출간되었습니다."
        price = random.randint(12000, 45000)
        color = random.choice(colors)
        cover_image = f"https://placehold.co/200x300/{color}/FFFFFF?text={book['category']}"

        value = f"  ('{book_id}', '{title}', '{author}', '{publisher}', {year}, '{isbn}', '{description}', {price}, '{cover_image}')"
        values.append(value)

    sql_lines.append(",\n".join(values))
    sql_lines.append("ON DUPLICATE KEY UPDATE title=title;")
    sql_lines.append("")

    return "\n".join(sql_lines)


def main():
    """메인 실행"""
    print("=" * 60)
    print("📚 도서 샘플 데이터 100권 생성")
    print("=" * 60)

    sql_content = generate_sql()
    output_file = "sample_books_100.sql"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(sql_content)

    print(f"✅ 총 {len(BOOKS_DATA)}권의 도서 데이터 생성 완료")
    print(f"📝 SQL 파일: {output_file}")
    print(f"\n카테고리별:")
    categories = {}
    for book in BOOKS_DATA:
        cat = book["category"]
        categories[cat] = categories.get(cat, 0) + 1

    for cat, count in sorted(categories.items()):
        print(f"  - {cat}: {count}권")

    print(f"\n사용방법:")
    print(f"  1. 로컬 DB에 직접 실행:")
    print(f"     mysql -h 0.0.0.0 -u suslmk -pmaster pf2025 < {output_file}")
    print(f"  2. mariadb-deployment.yaml에 추가")


if __name__ == "__main__":
    main()
