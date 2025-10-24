package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

type BorrowItem struct {
	ID         int        `json:"id"`
	UserID     string     `json:"user_id"`
	BookID     string     `json:"book_id"`
	Title      string     `json:"title"`
	Author     string     `json:"author"`
	BorrowedAt time.Time  `json:"borrowed_at"`
	DueDate    string     `json:"due_date"`
	ReturnedAt *time.Time `json:"returned_at,omitempty"`
	Status     string     `json:"status"`
}

type BorrowRequest struct {
	BookID string `json:"book_id" binding:"required"`
	Title  string `json:"title" binding:"required"`
	Author string `json:"author" binding:"required"`
}

var (
	db          *sql.DB
	redisClient *redis.Client
	ctx         = context.Background()
)

func main() {
	if err := godotenv.Load("../../.env.local"); err != nil {
		log.Println("No .env.local file found, using environment variables or defaults")
	}

	dbHost := getEnv("DB_HOST", "mariadb-central.default.svc.cluster.local")
	dbUser := getEnv("DB_USER", "root")
	dbPassword := getEnv("DB_PASSWORD", "rootpassword")
	dbName := getEnv("DB_NAME", "library")
	redisAddr := getEnv("REDIS_ADDR", "redis-central.default.svc.cluster.local:6379")

	var err error
	dsn := dbUser + ":" + dbPassword + "@tcp(" + dbHost + ":3306)/" + dbName + "?parseTime=true"
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Failed to connect to MariaDB: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping MariaDB: %v", err)
	}
	log.Println("Successfully connected to MariaDB")

	redisClient = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Successfully connected to Redis")

	router := gin.Default()
	router.Use(corsMiddleware())

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	router.GET("/borrows", authMiddleware(), handleGetBorrows)
	router.GET("/borrows/history", authMiddleware(), handleGetBorrowHistory)
	router.POST("/borrows/borrow", authMiddleware(), handleBorrowBook)
	router.POST("/borrows/return/:book_id", authMiddleware(), handleReturnBook)

	// 관리자 전용 API
	router.POST("/borrows/admin/borrow", authMiddleware(), adminMiddleware(), handleAdminBorrowBook)
	router.POST("/borrows/admin/return/:borrow_id", authMiddleware(), adminMiddleware(), handleAdminReturnBook)
	router.GET("/borrows/admin/all", authMiddleware(), adminMiddleware(), handleGetAllBorrows)
	router.GET("/borrows/admin/history", authMiddleware(), adminMiddleware(), handleGetAllBorrowHistory)

	port := getEnv("BORROW_SERVICE_PORT", getEnv("PORT", "8083"))
	log.Printf("Borrow service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization token"})
			c.Abort()
			return
		}

		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		sessionKey := "session:" + token
		username, err := redisClient.Get(ctx, sessionKey).Result()
		if err != nil {
			if err == redis.Nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired session"})
				c.Abort()
				return
			}
			log.Printf("Redis error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify session"})
			c.Abort()
			return
		}

		// 사용자 역할 조회 (username으로 조회)
		var role string
		query := "SELECT role FROM users WHERE username = ?"
		err = db.QueryRow(query, username).Scan(&role)
		if err != nil {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify user role"})
			c.Abort()
			return
		}

		c.Set("user_id", username)
		c.Set("role", role)
		c.Next()
	}
}

func adminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
			c.Abort()
			return
		}

		if role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "관리자 권한이 필요합니다"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func handleGetBorrows(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	query := `SELECT id, user_id, book_id, title, author, borrowed_at, due_date, returned_at, status
	          FROM borrows WHERE user_id = ? AND status = 'borrowed' ORDER BY borrowed_at DESC`

	rows, err := db.Query(query, userIDStr)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "대여 목록을 불러오는데 실패했습니다"})
		return
	}
	defer rows.Close()

	borrows := []BorrowItem{}
	for rows.Next() {
		var item BorrowItem
		err := rows.Scan(&item.ID, &item.UserID, &item.BookID, &item.Title, &item.Author,
			&item.BorrowedAt, &item.DueDate, &item.ReturnedAt, &item.Status)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		borrows = append(borrows, item)
	}

	log.Printf("User %s retrieved %d rented books (대여)", userIDStr, len(borrows))
	c.JSON(http.StatusOK, borrows)
}

func handleGetBorrowHistory(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	// 모든 대여 이력 조회 (현재 대여중 + 반납 완료)
	query := `SELECT id, user_id, book_id, title, author, borrowed_at, due_date, returned_at, status
	          FROM borrows WHERE user_id = ? ORDER BY borrowed_at DESC`

	rows, err := db.Query(query, userIDStr)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "대여 이력을 불러오는데 실패했습니다"})
		return
	}
	defer rows.Close()

	history := []BorrowItem{}
	for rows.Next() {
		var item BorrowItem
		err := rows.Scan(&item.ID, &item.UserID, &item.BookID, &item.Title, &item.Author,
			&item.BorrowedAt, &item.DueDate, &item.ReturnedAt, &item.Status)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		history = append(history, item)
	}

	log.Printf("User %s retrieved %d borrow history records (대여 이력)", userIDStr, len(history))
	c.JSON(http.StatusOK, history)
}

func handleBorrowBook(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	var req BorrowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 트랜잭션 시작
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Transaction error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 대여에 실패했습니다"})
		return
	}
	defer tx.Rollback()

	// 대여 가능한 복본 찾기 (FOR UPDATE로 잠금)
	var copyID int
	findCopyQuery := `SELECT id FROM book_copies
	                  WHERE book_id = ? AND status = 'available'
	                  LIMIT 1 FOR UPDATE`
	err = tx.QueryRow(findCopyQuery, req.BookID).Scan(&copyID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "대여 가능한 복본이 없습니다"})
			return
		}
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 확인에 실패했습니다"})
		return
	}

	// 복본 상태를 'borrowed'로 변경
	updateCopyQuery := `UPDATE book_copies SET status = 'borrowed' WHERE id = ?`
	_, err = tx.Exec(updateCopyQuery, copyID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "복본 상태 업데이트에 실패했습니다"})
		return
	}

	dueDate := time.Now().AddDate(0, 0, 14).Format("2006-01-02")

	// 대여 기록 생성
	insertBorrowQuery := `INSERT INTO borrows (user_id, book_id, title, author, due_date, status)
	                      VALUES (?, ?, ?, ?, ?, 'borrowed')`
	_, err = tx.Exec(insertBorrowQuery, userIDStr, req.BookID, req.Title, req.Author, dueDate)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 대여에 실패했습니다"})
		return
	}

	// 트랜잭션 커밋
	if err := tx.Commit(); err != nil {
		log.Printf("Commit error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 대여에 실패했습니다"})
		return
	}

	log.Printf("User %s rented book %s (copy %d)", userIDStr, req.BookID, copyID)
	c.JSON(http.StatusOK, gin.H{
		"message": "도서가 대여되었습니다",
		"due_date": dueDate,
	})
}

func handleReturnBook(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)
	bookID := c.Param("book_id")

	// 트랜잭션 시작
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Transaction error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 반납에 실패했습니다"})
		return
	}
	defer tx.Rollback()

	// 대여 기록 업데이트
	updateBorrowQuery := `UPDATE borrows SET status = 'returned', returned_at = NOW()
	                      WHERE user_id = ? AND book_id = ? AND status = 'borrowed'`
	result, err := tx.Exec(updateBorrowQuery, userIDStr, bookID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 반납에 실패했습니다"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "대여 목록에서 도서를 찾을 수 없습니다"})
		return
	}

	// 대여 중인 복본 하나를 'available'로 변경
	updateCopyQuery := `UPDATE book_copies SET status = 'available'
	                    WHERE book_id = ? AND status = 'borrowed'
	                    LIMIT 1`
	_, err = tx.Exec(updateCopyQuery, bookID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "복본 상태 업데이트에 실패했습니다"})
		return
	}

	// 트랜잭션 커밋
	if err := tx.Commit(); err != nil {
		log.Printf("Commit error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 반납에 실패했습니다"})
		return
	}

	log.Printf("User %s returned book %s (반납)", userIDStr, bookID)
	c.JSON(http.StatusOK, gin.H{"message": "도서가 반납되었습니다"})
}

// 관리자: 특정 사용자를 위한 도서 대여 등록
func handleAdminBorrowBook(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	adminIDStr := adminID.(string)

	var req struct {
		UserID string `json:"user_id" binding:"required"`
		BookID string `json:"book_id" binding:"required"`
		Title  string `json:"title" binding:"required"`
		Author string `json:"author" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 트랜잭션 시작
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Transaction error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 대여 등록에 실패했습니다"})
		return
	}
	defer tx.Rollback()

	// 대여 가능한 복본 찾기
	var copyID int
	findCopyQuery := `SELECT id FROM book_copies
	                  WHERE book_id = ? AND status = 'available'
	                  LIMIT 1 FOR UPDATE`
	err = tx.QueryRow(findCopyQuery, req.BookID).Scan(&copyID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "대여 가능한 복본이 없습니다"})
			return
		}
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 확인에 실패했습니다"})
		return
	}

	// 복본 상태를 'borrowed'로 변경
	updateCopyQuery := `UPDATE book_copies SET status = 'borrowed' WHERE id = ?`
	_, err = tx.Exec(updateCopyQuery, copyID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "복본 상태 업데이트에 실패했습니다"})
		return
	}

	dueDate := time.Now().AddDate(0, 0, 14).Format("2006-01-02")

	insertBorrowQuery := `INSERT INTO borrows (user_id, book_id, title, author, due_date, status)
	                      VALUES (?, ?, ?, ?, ?, 'borrowed')`
	_, err = tx.Exec(insertBorrowQuery, req.UserID, req.BookID, req.Title, req.Author, dueDate)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 대여 등록에 실패했습니다"})
		return
	}

	// 트랜잭션 커밋
	if err := tx.Commit(); err != nil {
		log.Printf("Commit error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 대여 등록에 실패했습니다"})
		return
	}

	log.Printf("Admin %s registered borrow for user %s, book %s (copy %d)", adminIDStr, req.UserID, req.BookID, copyID)
	c.JSON(http.StatusOK, gin.H{
		"message": "도서 대여가 등록되었습니다",
		"due_date": dueDate,
	})
}

// 관리자: 대여 ID로 반납 처리
func handleAdminReturnBook(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	adminIDStr := adminID.(string)
	borrowID := c.Param("borrow_id")

	// 트랜잭션 시작
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Transaction error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 반납 처리에 실패했습니다"})
		return
	}
	defer tx.Rollback()

	// 대여 기록에서 book_id 조회
	var bookID string
	getBookIDQuery := `SELECT book_id FROM borrows WHERE id = ? AND status = 'borrowed'`
	err = tx.QueryRow(getBookIDQuery, borrowID).Scan(&bookID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "대여 기록을 찾을 수 없습니다"})
			return
		}
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "대여 기록 조회에 실패했습니다"})
		return
	}

	// 대여 기록 업데이트
	updateBorrowQuery := `UPDATE borrows SET status = 'returned', returned_at = NOW()
	                      WHERE id = ? AND status = 'borrowed'`
	result, err := tx.Exec(updateBorrowQuery, borrowID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 반납 처리에 실패했습니다"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "대여 기록을 찾을 수 없습니다"})
		return
	}

	// 대여 중인 복본 하나를 'available'로 변경
	updateCopyQuery := `UPDATE book_copies SET status = 'available'
	                    WHERE book_id = ? AND status = 'borrowed'
	                    LIMIT 1`
	_, err = tx.Exec(updateCopyQuery, bookID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "복본 상태 업데이트에 실패했습니다"})
		return
	}

	// 트랜잭션 커밋
	if err := tx.Commit(); err != nil {
		log.Printf("Commit error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 반납 처리에 실패했습니다"})
		return
	}

	log.Printf("Admin %s processed return for borrow ID %s, book %s", adminIDStr, borrowID, bookID)
	c.JSON(http.StatusOK, gin.H{"message": "도서 반납이 처리되었습니다"})
}

// 관리자: 모든 사용자의 대여 목록 조회 (대여 중인 것만)
func handleGetAllBorrows(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	adminIDStr := adminID.(string)

	query := `SELECT id, user_id, book_id, title, author, borrowed_at, due_date, returned_at, status
	          FROM borrows WHERE status = 'borrowed' ORDER BY borrowed_at DESC`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "대여 목록을 불러오는데 실패했습니다"})
		return
	}
	defer rows.Close()

	borrows := []BorrowItem{}
	for rows.Next() {
		var item BorrowItem
		err := rows.Scan(&item.ID, &item.UserID, &item.BookID, &item.Title, &item.Author,
			&item.BorrowedAt, &item.DueDate, &item.ReturnedAt, &item.Status)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		borrows = append(borrows, item)
	}

	log.Printf("Admin %s retrieved %d active borrows from all users", adminIDStr, len(borrows))
	c.JSON(http.StatusOK, borrows)
}

// 관리자: 모든 사용자의 대여 이력 조회 (전체)
func handleGetAllBorrowHistory(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	adminIDStr := adminID.(string)

	query := `SELECT id, user_id, book_id, title, author, borrowed_at, due_date, returned_at, status
	          FROM borrows ORDER BY borrowed_at DESC`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "대여 이력을 불러오는데 실패했습니다"})
		return
	}
	defer rows.Close()

	borrows := []BorrowItem{}
	for rows.Next() {
		var item BorrowItem
		err := rows.Scan(&item.ID, &item.UserID, &item.BookID, &item.Title, &item.Author,
			&item.BorrowedAt, &item.DueDate, &item.ReturnedAt, &item.Status)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		borrows = append(borrows, item)
	}

	log.Printf("Admin %s retrieved %d total borrow history records", adminIDStr, len(borrows))
	c.JSON(http.StatusOK, borrows)
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
