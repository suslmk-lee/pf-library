package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
)

type Book struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Author      string  `json:"author"`
	Publisher   string  `json:"publisher"`
	Year        int     `json:"year"`
	ISBN        string  `json:"isbn"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	CoverImage  string  `json:"cover_image"`
}

var db *sql.DB

func main() {
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

	// 서버 시작
	port := getEnv("PORT", "8080")
	log.Printf("Book service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func handleGetBooks(c *gin.Context) {
	query := "SELECT id, title, author, publisher, year, isbn, description, price, cover_image FROM books"
	rows, err := db.Query(query)
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

	log.Printf("Retrieved %d books", len(books))
	c.JSON(http.StatusOK, books)
}

func handleGetBook(c *gin.Context) {
	bookID := c.Param("id")

	query := "SELECT id, title, author, publisher, year, isbn, description, price, cover_image FROM books WHERE id = ?"
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

	log.Printf("Retrieved book: %s", book.Title)
	c.JSON(http.StatusOK, book)
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

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
