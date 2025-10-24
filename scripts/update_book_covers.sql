-- 도서 표지 이미지 업데이트
-- Via.placeholder.com이나 placehold.co 대신 더 안정적인 서비스 사용

-- 방법 1: DummyImage.com 사용 (간단하고 안정적)
UPDATE books SET cover_image = CONCAT('https://dummyimage.com/200x300/',
  CASE
    WHEN id % 8 = 0 THEN '4A90E2'  -- 파랑
    WHEN id % 8 = 1 THEN '50C878'  -- 초록
    WHEN id % 8 = 2 THEN 'E74C3C'  -- 빨강
    WHEN id % 8 = 3 THEN '9B59B6'  -- 보라
    WHEN id % 8 = 4 THEN 'F39C12'  -- 주황
    WHEN id % 8 = 5 THEN '1ABC9C'  -- 청록
    WHEN id % 8 = 6 THEN 'E67E22'  -- 오렌지
    ELSE '3498DB'                   -- 하늘색
  END,
  '/ffffff&text=', REPLACE(SUBSTRING(title, 1, 10), ' ', '+'))
WHERE cover_image LIKE '%placehold.co%' OR cover_image LIKE '%via.placeholder%';

-- 방법 2: Unsplash 무료 이미지 사용 (실제 책 이미지처럼 보임)
-- 특정 도서에 대해 수동으로 업데이트
UPDATE books SET cover_image = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=200&h=300&fit=crop' WHERE title LIKE '%클린 코드%';
UPDATE books SET cover_image = 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=200&h=300&fit=crop' WHERE title LIKE '%리팩토링%';
UPDATE books SET cover_image = 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=200&h=300&fit=crop' WHERE title LIKE '%소설%' OR title LIKE '%문학%';

-- 방법 3: 카테고리별 대표 이미지 (더 의미있는 이미지)
-- IT 도서
UPDATE books SET cover_image = 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=200&h=300&fit=crop'
WHERE (title LIKE '%프로그래밍%' OR title LIKE '%코드%' OR title LIKE '%자바%' OR title LIKE '%파이썬%' OR title LIKE '%개발%')
AND (cover_image LIKE '%placehold%' OR cover_image LIKE '%dummyimage%');

-- 문학 도서
UPDATE books SET cover_image = 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=200&h=300&fit=crop'
WHERE (title LIKE '%소설%' OR author LIKE '%한강%' OR author LIKE '%조남주%' OR title LIKE '%문학%')
AND (cover_image LIKE '%placehold%' OR cover_image LIKE '%dummyimage%');

-- 자기계발 도서
UPDATE books SET cover_image = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200&h=300&fit=crop'
WHERE (title LIKE '%습관%' OR title LIKE '%성공%' OR title LIKE '%자기계발%')
AND (cover_image LIKE '%placehold%' OR cover_image LIKE '%dummyimage%');

-- 과학 도서
UPDATE books SET cover_image = 'https://images.unsplash.com/photo-1636690513751-da0eb4bfe718?w=200&h=300&fit=crop'
WHERE (title LIKE '%과학%' OR title LIKE '%물리%' OR title LIKE '%우주%')
AND (cover_image LIKE '%placehold%' OR cover_image LIKE '%dummyimage%');
