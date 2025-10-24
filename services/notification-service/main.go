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

type Notification struct {
	ID        int       `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	RelatedID *int      `json:"related_id,omitempty"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
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

	// 알림 API
	router.GET("/notifications", handleGetNotifications)
	router.GET("/notifications/unread-count", handleGetUnreadCount)
	router.PUT("/notifications/:id/read", handleMarkAsRead)
	router.PUT("/notifications/mark-all-read", handleMarkAllAsRead)
	router.DELETE("/notifications/:id", handleDeleteNotification)

	// 백그라운드 작업: 연체 알림, 반납 예정 알림
	go scheduleNotificationChecks()

	port := getEnv("NOTIFICATION_SERVICE_PORT", getEnv("PORT", "8084"))
	log.Printf("Notification service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// 사용자의 알림 목록 조회
func handleGetNotifications(c *gin.Context) {
	userID := c.Query("user_id") // user_id 쿼리 파라미터로 받음

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	query := `SELECT id, user_id, type, title, message, related_id, is_read, created_at
	          FROM notifications
	          WHERE user_id = ?
	          ORDER BY created_at DESC
	          LIMIT 50`

	rows, err := db.Query(query, userID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "알림을 불러오는데 실패했습니다"})
		return
	}
	defer rows.Close()

	notifications := []Notification{}
	for rows.Next() {
		var notification Notification
		err := rows.Scan(
			&notification.ID,
			&notification.UserID,
			&notification.Type,
			&notification.Title,
			&notification.Message,
			&notification.RelatedID,
			&notification.IsRead,
			&notification.CreatedAt,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		notifications = append(notifications, notification)
	}

	log.Printf("User %s retrieved %d notifications", userID, len(notifications))
	c.JSON(http.StatusOK, notifications)
}

// 읽지 않은 알림 개수 조회
func handleGetUnreadCount(c *gin.Context) {
	userID := c.Query("user_id")

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	var count int
	query := "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = FALSE"
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "알림 개수를 불러오는데 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// 알림을 읽음으로 표시
func handleMarkAsRead(c *gin.Context) {
	notificationID := c.Param("id")

	query := "UPDATE notifications SET is_read = TRUE WHERE id = ?"
	result, err := db.Exec(query, notificationID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "알림 업데이트에 실패했습니다"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "알림을 찾을 수 없습니다"})
		return
	}

	log.Printf("Marked notification %s as read", notificationID)
	c.JSON(http.StatusOK, gin.H{"message": "알림이 읽음 처리되었습니다"})
}

// 모든 알림을 읽음으로 표시
func handleMarkAllAsRead(c *gin.Context) {
	userID := c.Query("user_id")

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	query := "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE"
	result, err := db.Exec(query, userID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "알림 업데이트에 실패했습니다"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Marked %d notifications as read for user %s", rowsAffected, userID)
	c.JSON(http.StatusOK, gin.H{"message": "모든 알림이 읽음 처리되었습니다", "count": rowsAffected})
}

// 알림 삭제
func handleDeleteNotification(c *gin.Context) {
	notificationID := c.Param("id")

	query := "DELETE FROM notifications WHERE id = ?"
	result, err := db.Exec(query, notificationID)
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "알림 삭제에 실패했습니다"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "알림을 찾을 수 없습니다"})
		return
	}

	log.Printf("Deleted notification %s", notificationID)
	c.JSON(http.StatusOK, gin.H{"message": "알림이 삭제되었습니다"})
}

// 백그라운드 작업: 주기적으로 연체 알림과 반납 예정 알림 생성
func scheduleNotificationChecks() {
	ticker := time.NewTicker(1 * time.Hour) // 1시간마다 체크
	defer ticker.Stop()

	// 서버 시작 시 즉시 한 번 실행
	checkOverdueBorrows()
	checkDueSoonBorrows()

	for range ticker.C {
		checkOverdueBorrows()
		checkDueSoonBorrows()
	}
}

// 연체된 대여 확인 및 알림 생성
func checkOverdueBorrows() {
	query := `SELECT id, user_id, title, due_date
	          FROM borrows
	          WHERE status = 'borrowed' AND DATE(due_date) < CURDATE()`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Failed to check overdue borrows: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var borrowID int
		var userID, title, dueDate string
		if err := rows.Scan(&borrowID, &userID, &title, &dueDate); err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		// 이미 알림이 있는지 확인
		var count int
		checkQuery := `SELECT COUNT(*) FROM notifications
		               WHERE user_id = ? AND type = 'overdue' AND related_id = ?`
		db.QueryRow(checkQuery, userID, borrowID).Scan(&count)

		if count == 0 {
			// 연체 알림 생성
			insertQuery := `INSERT INTO notifications (user_id, type, title, message, related_id)
			                VALUES (?, 'overdue', '도서 연체', ?, ?)`
			message := title + " 도서가 연체되었습니다. 빠른 반납 부탁드립니다."
			_, err := db.Exec(insertQuery, userID, message, borrowID)
			if err != nil {
				log.Printf("Failed to create overdue notification: %v", err)
			} else {
				log.Printf("Created overdue notification for user %s, borrow %d", userID, borrowID)
			}
		}
	}
}

// 반납 예정 대여 확인 및 알림 생성 (3일 전)
func checkDueSoonBorrows() {
	query := `SELECT id, user_id, title, due_date
	          FROM borrows
	          WHERE status = 'borrowed' AND DATE(due_date) = DATE_ADD(CURDATE(), INTERVAL 3 DAY)`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Failed to check due soon borrows: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var borrowID int
		var userID, title, dueDate string
		if err := rows.Scan(&borrowID, &userID, &title, &dueDate); err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		// 이미 알림이 있는지 확인
		var count int
		checkQuery := `SELECT COUNT(*) FROM notifications
		               WHERE user_id = ? AND type = 'due_soon' AND related_id = ?`
		db.QueryRow(checkQuery, userID, borrowID).Scan(&count)

		if count == 0 {
			// 반납 예정 알림 생성
			insertQuery := `INSERT INTO notifications (user_id, type, title, message, related_id)
			                VALUES (?, 'due_soon', '반납 예정', ?, ?)`
			message := title + " 도서의 반납 기한이 3일 남았습니다."
			_, err := db.Exec(insertQuery, userID, message, borrowID)
			if err != nil {
				log.Printf("Failed to create due soon notification: %v", err)
			} else {
				log.Printf("Created due soon notification for user %s, borrow %d", userID, borrowID)
			}
		}
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
