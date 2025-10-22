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
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type LoginRequest struct {
	ID       string `json:"id" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token  string `json:"token"`
	UserID string `json:"user_id"`
}

var (
	db          *sql.DB
	redisClient *redis.Client
	ctx         = context.Background()
)

func main() {
	// 환경 변수 읽기
	dbHost := getEnv("DB_HOST", "mariadb-central.default.svc.cluster.local")
	dbUser := getEnv("DB_USER", "root")
	dbPassword := getEnv("DB_PASSWORD", "rootpassword")
	dbName := getEnv("DB_NAME", "library")
	redisAddr := getEnv("REDIS_ADDR", "redis-central.default.svc.cluster.local:6379")

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

	// Redis 연결
	redisClient = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	// Redis 연결 확인
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Successfully connected to Redis")

	// Gin 라우터 설정
	router := gin.Default()

	// CORS 설정
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// 인증 API
	router.POST("/login", handleLogin)
	router.POST("/logout", handleLogout)

	// 서버 시작
	port := getEnv("PORT", "8080")
	log.Printf("User service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func handleLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// MariaDB에서 사용자 조회
	var userID, storedPassword string
	query := "SELECT id, password FROM users WHERE username = ?"
	err := db.QueryRow(query, req.ID).Scan(&userID, &storedPassword)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// 비밀번호 확인 (실제 환경에서는 bcrypt 등 사용)
	if storedPassword != req.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// 세션 토큰 생성
	token := uuid.New().String()

	// Redis에 세션 저장 (24시간 유효)
	sessionKey := "session:" + token
	err = redisClient.Set(ctx, sessionKey, userID, 24*time.Hour).Err()
	if err != nil {
		log.Printf("Redis error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	log.Printf("User %s logged in successfully with token %s", req.ID, token)

	c.JSON(http.StatusOK, LoginResponse{
		Token:  token,
		UserID: userID,
	})
}

func handleLogout(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing authorization token"})
		return
	}

	// Bearer 토큰에서 실제 토큰 추출
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Redis에서 세션 삭제
	sessionKey := "session:" + token
	err := redisClient.Del(ctx, sessionKey).Err()
	if err != nil {
		log.Printf("Redis error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to logout"})
		return
	}

	log.Printf("Session %s logged out successfully", token)

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
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
