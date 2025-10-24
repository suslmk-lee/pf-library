package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

type Book struct {
	ID               string  `json:"id"`
	Title            string  `json:"title"`
	Author           string  `json:"author"`
	Publisher        string  `json:"publisher"`
	Year             int     `json:"year"`
	ISBN             string  `json:"isbn"`
	Description      string  `json:"description"`
	Price            float64 `json:"price"`
	CoverImage       string  `json:"cover_image"`
	TotalCopies      int     `json:"total_copies"`
	AvailableCopies  int     `json:"available_copies"`
}

type BookCopy struct {
	ID           int    `json:"id"`
	BookID       string `json:"book_id"`
	CopyNumber   int    `json:"copy_number"`
	Status       string `json:"status"`
	Location     string `json:"location"`
	AcquiredDate string `json:"acquired_date"`
	Notes        string `json:"notes"`
}

var db *sql.DB

func main() {
	// .env.local 파일 로드 (파일이 없어도 에러 무시)
	if err := godotenv.Load("../../.env.local"); err != nil {
		log.Println("No .env.local file found, using environment variables or defaults")
	}

	// 환경 변수 읽기
	dbHost := getEnv("DB_HOST", "mariadb-central.default.svc.cluster.local")
	dbUser := getEnv("DB_USER", "root")
	dbPassword := getEnv("DB_PASSWORD", "rootpassword")
	dbName := getEnv("DB_NAME", "library")

	// MariaDB 연결
	var err error
	dsn := dbUser + ":" + dbPassword + "@tcp(" + dbHost + ":3306)/" + dbName + "?parseTime=true"
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Failed to connect to MariaDB: %v", err)
	}
	defer db.Close()

	// MariaDB 연결 확인
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping MariaDB: %v", err)
	}
	log.Println("Successfully connected to MariaDB")

	// Gin 라우터 설정
	router := gin.Default()

	// CORS 설정
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// 도서 API
	router.GET("/books", handleGetBooks)
	router.GET("/books/:id", handleGetBook)
	router.GET("/books/:id/copies", handleGetBookCopies)

	// 복본 관리 API (관리자용)
	router.GET("/admin/copies", handleGetAllCopies)
	router.POST("/admin/copies", handleAddCopy)
	router.PUT("/admin/copies/:id", handleUpdateCopy)
	router.DELETE("/admin/copies/:id", handleDeleteCopy)

	// 서버 시작
	port := getEnv("BOOK_SERVICE_PORT", getEnv("PORT", "8082"))
	log.Printf("Book service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func handleGetBooks(c *gin.Context) {
	// 쿼리 파라미터 읽기
	search := c.Query("search")      // 제목 검색
	author := c.Query("author")      // 저자 필터
	publisher := c.Query("publisher") // 출판사 필터
	year := c.Query("year")          // 연도 필터

	// 동적 쿼리 생성 - 복본 정보 포함
	query := `SELECT b.id, b.title, b.author, b.publisher, b.year, b.isbn, b.description, b.price, b.cover_image,
	          COALESCE(COUNT(bc.id), 0) as total_copies,
	          COALESCE(SUM(CASE WHEN bc.status = 'available' THEN 1 ELSE 0 END), 0) as available_copies
	          FROM books b
	          LEFT JOIN book_copies bc ON b.id = bc.book_id
	          WHERE 1=1`
	args := []interface{}{}

	if search != "" {
		query += " AND b.title LIKE ?"
		args = append(args, "%"+search+"%")
	}
	if author != "" {
		query += " AND b.author LIKE ?"
		args = append(args, "%"+author+"%")
	}
	if publisher != "" {
		query += " AND b.publisher LIKE ?"
		args = append(args, "%"+publisher+"%")
	}
	if year != "" {
		query += " AND b.year = ?"
		args = append(args, year)
	}

	query += " GROUP BY b.id ORDER BY b.created_at DESC"

	log.Printf("Executing query: %s with args: %v", query, args)

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch books"})
		return
	}
	defer rows.Close()

	books := []Book{}
	for rows.Next() {
		var book Book
		err := rows.Scan(
			&book.ID,
			&book.Title,
			&book.Author,
			&book.Publisher,
			&book.Year,
			&book.ISBN,
			&book.Description,
			&book.Price,
			&book.CoverImage,
			&book.TotalCopies,
			&book.AvailableCopies,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		books = append(books, book)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Rows error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch books"})
		return
	}

	log.Printf("Retrieved %d books (filtered)", len(books))
	c.JSON(http.StatusOK, books)
}

func handleGetBook(c *gin.Context) {
	bookID := c.Param("id")

	query := `SELECT b.id, b.title, b.author, b.publisher, b.year, b.isbn, b.description, b.price, b.cover_image,
	          COALESCE(COUNT(bc.id), 0) as total_copies,
	          COALESCE(SUM(CASE WHEN bc.status = 'available' THEN 1 ELSE 0 END), 0) as available_copies
	          FROM books b
	          LEFT JOIN book_copies bc ON b.id = bc.book_id
	          WHERE b.id = ?
	          GROUP BY b.id`
	var book Book
	err := db.QueryRow(query, bookID).Scan(
		&book.ID,
		&book.Title,
		&book.Author,
		&book.Publisher,
		&book.Year,
		&book.ISBN,
		&book.Description,
		&book.Price,
		&book.CoverImage,
		&book.TotalCopies,
		&book.AvailableCopies,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Book not found"})
			return
		}
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch book"})
		return
	}

	log.Printf("Retrieved book: %s (Total: %d, Available: %d)", book.Title, book.TotalCopies, book.AvailableCopies)
	c.JSON(http.StatusOK, book)
}

func handleGetBookCopies(c *gin.Context) {
	bookID := c.Param("id")

	query := `SELECT id, book_id, copy_number, status, location, acquired_date, COALESCE(notes, '') as notes
	          FROM book_copies
	          WHERE book_id = ?
	          ORDER BY copy_number`

	rows, err := db.Query(query, bookID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch book copies"})
		return
	}
	defer rows.Close()

	copies := []BookCopy{}
	for rows.Next() {
		var copy BookCopy
		err := rows.Scan(
			&copy.ID,
			&copy.BookID,
			&copy.CopyNumber,
			&copy.Status,
			&copy.Location,
			&copy.AcquiredDate,
			&copy.Notes,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		copies = append(copies, copy)
	}

	log.Printf("Retrieved %d copies for book %s", len(copies), bookID)
	c.JSON(http.StatusOK, copies)
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// 관리자: 모든 복본 조회 (책 정보와 함께)
func handleGetAllCopies(c *gin.Context) {
	bookID := c.Query("book_id") // 선택적 필터

	query := `SELECT bc.id, bc.book_id, bc.copy_number, bc.status, bc.location, bc.acquired_date,
	          COALESCE(bc.notes, '') as notes, b.title, b.author
	          FROM book_copies bc
	          JOIN books b ON bc.book_id = b.id
	          WHERE 1=1`
	args := []interface{}{}

	if bookID != "" {
		query += " AND bc.book_id = ?"
		args = append(args, bookID)
	}

	query += " ORDER BY b.title, bc.copy_number"

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch copies"})
		return
	}
	defer rows.Close()

	type CopyWithBook struct {
		BookCopy
		BookTitle  string `json:"book_title"`
		BookAuthor string `json:"book_author"`
	}

	copies := []CopyWithBook{}
	for rows.Next() {
		var copy CopyWithBook
		err := rows.Scan(
			&copy.ID,
			&copy.BookID,
			&copy.CopyNumber,
			&copy.Status,
			&copy.Location,
			&copy.AcquiredDate,
			&copy.Notes,
			&copy.BookTitle,
			&copy.BookAuthor,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		copies = append(copies, copy)
	}

	log.Printf("Retrieved %d copies", len(copies))
	c.JSON(http.StatusOK, copies)
}

// 관리자: 복본 추가
func handleAddCopy(c *gin.Context) {
	var req struct {
		BookID       string `json:"book_id" binding:"required"`
		CopyNumber   int    `json:"copy_number" binding:"required"`
		Status       string `json:"status"`
		Location     string `json:"location"`
		AcquiredDate string `json:"acquired_date"`
		Notes        string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 기본값 설정
	if req.Status == "" {
		req.Status = "available"
	}

	query := `INSERT INTO book_copies (book_id, copy_number, status, location, acquired_date, notes)
	          VALUES (?, ?, ?, ?, ?, ?)`

	result, err := db.Exec(query, req.BookID, req.CopyNumber, req.Status, req.Location, req.AcquiredDate, req.Notes)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "복본 추가에 실패했습니다"})
		return
	}

	id, _ := result.LastInsertId()
	log.Printf("Added copy %d for book %s", id, req.BookID)
	c.JSON(http.StatusOK, gin.H{"message": "복본이 추가되었습니다", "id": id})
}

// 관리자: 복본 수정
func handleUpdateCopy(c *gin.Context) {
	copyID := c.Param("id")

	var req struct {
		Status       string `json:"status"`
		Location     string `json:"location"`
		AcquiredDate string `json:"acquired_date"`
		Notes        string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	query := `UPDATE book_copies
	          SET status = ?, location = ?, acquired_date = ?, notes = ?
	          WHERE id = ?`

	result, err := db.Exec(query, req.Status, req.Location, req.AcquiredDate, req.Notes, copyID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "복본 수정에 실패했습니다"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "복본을 찾을 수 없습니다"})
		return
	}

	log.Printf("Updated copy %s", copyID)
	c.JSON(http.StatusOK, gin.H{"message": "복본이 수정되었습니다"})
}

// 관리자: 복본 삭제
func handleDeleteCopy(c *gin.Context) {
	copyID := c.Param("id")

	// 대여 중인 복본인지 확인
	var status string
	err := db.QueryRow("SELECT status FROM book_copies WHERE id = ?", copyID).Scan(&status)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "복본을 찾을 수 없습니다"})
			return
		}
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "복본 확인에 실패했습니다"})
		return
	}

	if status == "borrowed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "대여 중인 복본은 삭제할 수 없습니다"})
		return
	}

	result, err := db.Exec("DELETE FROM book_copies WHERE id = ?", copyID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "복본 삭제에 실패했습니다"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "복본을 찾을 수 없습니다"})
		return
	}

	log.Printf("Deleted copy %s", copyID)
	c.JSON(http.StatusOK, gin.H{"message": "복본이 삭제되었습니다"})
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
