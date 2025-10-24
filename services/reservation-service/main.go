package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

type Reservation struct {
	ID         int       `json:"id"`
	UserID     string    `json:"user_id"`
	BookID     string    `json:"book_id"`
	BookTitle  string    `json:"book_title"`
	BookAuthor string    `json:"book_author"`
	ReservedAt time.Time `json:"reserved_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	Status     string    `json:"status"`
}

var db *sql.DB

func main() {
	if err := godotenv.Load("../../.env.local"); err != nil {
		log.Println("No .env.local file found, using environment variables or defaults")
	}

	dbHost := getEnv("DB_HOST", "mariadb-central.default.svc.cluster.local")
	dbUser := getEnv("DB_USER", "root")
	dbPassword := getEnv("DB_PASSWORD", "rootpassword")
	dbName := getEnv("DB_NAME", "library")

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

	router := gin.Default()
	router.Use(corsMiddleware())

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// 예약 API
	router.POST("/reservations", handleCreateReservation)
	router.GET("/reservations", handleGetReservations)
	router.DELETE("/reservations/:id", handleCancelReservation)

	// 백그라운드 작업: 예약 만료 체크, 도서 반납 시 예약 알림
	go scheduleReservationChecks()

	port := getEnv("RESERVATION_SERVICE_PORT", getEnv("PORT", "8085"))
	log.Printf("Reservation service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// 예약 생성
func handleCreateReservation(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
		BookID string `json:"book_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 도서가 대여 가능한지 확인
	var availableCopies int
	checkQuery := `SELECT COALESCE(SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END), 0)
	               FROM book_copies WHERE book_id = ?`
	err := db.QueryRow(checkQuery, req.BookID).Scan(&availableCopies)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "도서 확인에 실패했습니다"})
		return
	}

	if availableCopies > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "대여 가능한 도서입니다. 예약이 필요하지 않습니다"})
		return
	}

	// 이미 예약한 도서인지 확인
	var existingCount int
	existQuery := `SELECT COUNT(*) FROM reservations
	               WHERE user_id = ? AND book_id = ? AND status = 'active'`
	db.QueryRow(existQuery, req.UserID, req.BookID).Scan(&existingCount)

	if existingCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "이미 예약한 도서입니다"})
		return
	}

	// 예약 생성 (7일 후 만료)
	expiresAt := time.Now().AddDate(0, 0, 7)
	insertQuery := `INSERT INTO reservations (user_id, book_id, expires_at, status)
	                VALUES (?, ?, ?, 'active')`

	result, err := db.Exec(insertQuery, req.UserID, req.BookID, expiresAt)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "예약 생성에 실패했습니다"})
		return
	}

	id, _ := result.LastInsertId()
	log.Printf("User %s reserved book %s (reservation ID: %d)", req.UserID, req.BookID, id)
	c.JSON(http.StatusOK, gin.H{
		"message":    "도서가 예약되었습니다",
		"id":         id,
		"expires_at": expiresAt,
	})
}

// 사용자의 예약 목록 조회
func handleGetReservations(c *gin.Context) {
	userID := c.Query("user_id")

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	query := `SELECT r.id, r.user_id, r.book_id, b.title, b.author, r.reserved_at, r.expires_at, r.status
	          FROM reservations r
	          JOIN books b ON r.book_id = b.id
	          WHERE r.user_id = ?
	          ORDER BY r.reserved_at DESC`

	rows, err := db.Query(query, userID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "예약 목록을 불러오는데 실패했습니다"})
		return
	}
	defer rows.Close()

	reservations := []Reservation{}
	for rows.Next() {
		var reservation Reservation
		err := rows.Scan(
			&reservation.ID,
			&reservation.UserID,
			&reservation.BookID,
			&reservation.BookTitle,
			&reservation.BookAuthor,
			&reservation.ReservedAt,
			&reservation.ExpiresAt,
			&reservation.Status,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		reservations = append(reservations, reservation)
	}

	log.Printf("User %s retrieved %d reservations", userID, len(reservations))
	c.JSON(http.StatusOK, reservations)
}

// 예약 취소
func handleCancelReservation(c *gin.Context) {
	reservationID := c.Param("id")
	userID := c.Query("user_id")

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	query := `UPDATE reservations SET status = 'cancelled'
	          WHERE id = ? AND user_id = ? AND status = 'active'`

	result, err := db.Exec(query, reservationID, userID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "예약 취소에 실패했습니다"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "예약을 찾을 수 없습니다"})
		return
	}

	log.Printf("User %s cancelled reservation %s", userID, reservationID)
	c.JSON(http.StatusOK, gin.H{"message": "예약이 취소되었습니다"})
}

// 백그라운드 작업: 주기적으로 만료된 예약 처리 및 도서 반납 시 예약자에게 알림
func scheduleReservationChecks() {
	ticker := time.NewTicker(10 * time.Minute) // 10분마다 체크
	defer ticker.Stop()

	// 서버 시작 시 즉시 한 번 실행
	expireReservations()
	notifyAvailableReservations()

	for range ticker.C {
		expireReservations()
		notifyAvailableReservations()
	}
}

// 만료된 예약 처리
func expireReservations() {
	query := `UPDATE reservations
	          SET status = 'expired'
	          WHERE status = 'active' AND expires_at < NOW()`

	result, err := db.Exec(query)
	if err != nil {
		log.Printf("Failed to expire reservations: %v", err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		log.Printf("Expired %d reservations", rowsAffected)
	}
}

// 도서가 대여 가능해졌을 때 예약자에게 알림
func notifyAvailableReservations() {
	// 대여 가능한 복본이 있는 도서 중 예약이 있는 도서 찾기
	query := `SELECT DISTINCT r.id, r.user_id, r.book_id, b.title
	          FROM reservations r
	          JOIN books b ON r.book_id = b.id
	          JOIN book_copies bc ON r.book_id = bc.book_id
	          WHERE r.status = 'active'
	          AND bc.status = 'available'
	          AND r.notified = FALSE
	          ORDER BY r.reserved_at ASC`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Failed to check available reservations: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var reservationID int
		var userID, bookID, title string
		if err := rows.Scan(&reservationID, &userID, &bookID, &title); err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		// 알림 생성
		insertQuery := `INSERT INTO notifications (user_id, type, title, message, related_id)
		                VALUES (?, 'reservation_available', '예약 도서 대여 가능', ?, ?)`
		message := title + " 도서를 대여할 수 있습니다. 3일 이내에 대여해 주세요."
		_, err := db.Exec(insertQuery, userID, message, reservationID)
		if err != nil {
			log.Printf("Failed to create notification: %v", err)
			continue
		}

		// 예약을 알림 완료로 표시
		updateQuery := `UPDATE reservations SET notified = TRUE WHERE id = ?`
		db.Exec(updateQuery, reservationID)

		log.Printf("Notified user %s about available book %s (reservation %d)", userID, bookID, reservationID)
	}
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
