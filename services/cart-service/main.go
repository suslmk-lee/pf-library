package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type CartItem struct {
	BookID    string  `json:"book_id"`
	Title     string  `json:"title"`
	Author    string  `json:"author"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
	CoverImage string `json:"cover_image"`
}

type AddToCartRequest struct {
	BookID     string  `json:"book_id" binding:"required"`
	Title      string  `json:"title" binding:"required"`
	Author     string  `json:"author" binding:"required"`
	Price      float64 `json:"price" binding:"required"`
	CoverImage string  `json:"cover_image"`
}

var (
	redisClient *redis.Client
	ctx         = context.Background()
)

func main() {
	// 환경 변수 읽기
	redisAddr := getEnv("REDIS_ADDR", "redis-central.default.svc.cluster.local:6379")

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

	// 장바구니 API - 모두 세션 검증 필요
	router.GET("/cart", authMiddleware(), handleGetCart)
	router.POST("/cart/add", authMiddleware(), handleAddToCart)
	router.DELETE("/cart/remove/:book_id", authMiddleware(), handleRemoveFromCart)
	router.POST("/cart/clear", authMiddleware(), handleClearCart)

	// 서버 시작
	port := getEnv("PORT", "8080")
	log.Printf("Cart service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// authMiddleware는 세션 토큰을 검증하고 user_id를 컨텍스트에 저장합니다
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization token"})
			c.Abort()
			return
		}

		// Bearer 토큰에서 실제 토큰 추출
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		// Redis에서 세션 조회
		sessionKey := "session:" + token
		userID, err := redisClient.Get(ctx, sessionKey).Result()
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

		// user_id를 컨텍스트에 저장
		c.Set("user_id", userID)
		c.Next()
	}
}

func handleGetCart(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	// Redis에서 장바구니 조회
	cartKey := "cart:" + userIDStr
	cartData, err := redisClient.Get(ctx, cartKey).Result()
	if err != nil {
		if err == redis.Nil {
			// 장바구니가 비어있음
			c.JSON(http.StatusOK, []CartItem{})
			return
		}
		log.Printf("Redis error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch cart"})
		return
	}

	// JSON 파싱
	var cart []CartItem
	if err := json.Unmarshal([]byte(cartData), &cart); err != nil {
		log.Printf("JSON unmarshal error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse cart data"})
		return
	}

	log.Printf("User %s retrieved cart with %d items", userIDStr, len(cart))
	c.JSON(http.StatusOK, cart)
}

func handleAddToCart(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	var req AddToCartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 현재 장바구니 조회
	cartKey := "cart:" + userIDStr
	cart := []CartItem{}
	cartData, err := redisClient.Get(ctx, cartKey).Result()
	if err == nil {
		// 기존 장바구니가 있으면 파싱
		if err := json.Unmarshal([]byte(cartData), &cart); err != nil {
			log.Printf("JSON unmarshal error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse cart data"})
			return
		}
	} else if err != redis.Nil {
		log.Printf("Redis error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch cart"})
		return
	}

	// 이미 장바구니에 있는지 확인
	found := false
	for i := range cart {
		if cart[i].BookID == req.BookID {
			cart[i].Quantity++
			found = true
			break
		}
	}

	// 없으면 새로 추가
	if !found {
		cart = append(cart, CartItem{
			BookID:     req.BookID,
			Title:      req.Title,
			Author:     req.Author,
			Price:      req.Price,
			Quantity:   1,
			CoverImage: req.CoverImage,
		})
	}

	// Redis에 저장
	cartJSON, err := json.Marshal(cart)
	if err != nil {
		log.Printf("JSON marshal error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save cart"})
		return
	}

	err = redisClient.Set(ctx, cartKey, cartJSON, 0).Err()
	if err != nil {
		log.Printf("Redis error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save cart"})
		return
	}

	log.Printf("User %s added book %s to cart", userIDStr, req.BookID)
	c.JSON(http.StatusOK, gin.H{"message": "Book added to cart", "cart": cart})
}

func handleRemoveFromCart(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)
	bookID := c.Param("book_id")

	// 현재 장바구니 조회
	cartKey := "cart:" + userIDStr
	cart := []CartItem{}
	cartData, err := redisClient.Get(ctx, cartKey).Result()
	if err != nil {
		if err == redis.Nil {
			c.JSON(http.StatusOK, gin.H{"message": "Cart is empty"})
			return
		}
		log.Printf("Redis error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch cart"})
		return
	}

	// 파싱
	if err := json.Unmarshal([]byte(cartData), &cart); err != nil {
		log.Printf("JSON unmarshal error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse cart data"})
		return
	}

	// 해당 도서 제거
	newCart := []CartItem{}
	for _, item := range cart {
		if item.BookID != bookID {
			newCart = append(newCart, item)
		}
	}

	// Redis에 저장
	cartJSON, err := json.Marshal(newCart)
	if err != nil {
		log.Printf("JSON marshal error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save cart"})
		return
	}

	err = redisClient.Set(ctx, cartKey, cartJSON, 0).Err()
	if err != nil {
		log.Printf("Redis error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save cart"})
		return
	}

	log.Printf("User %s removed book %s from cart", userIDStr, bookID)
	c.JSON(http.StatusOK, gin.H{"message": "Book removed from cart", "cart": newCart})
}

func handleClearCart(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	// Redis에서 장바구니 삭제
	cartKey := "cart:" + userIDStr
	err := redisClient.Del(ctx, cartKey).Err()
	if err != nil {
		log.Printf("Redis error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear cart"})
		return
	}

	log.Printf("User %s cleared cart", userIDStr)
	c.JSON(http.StatusOK, gin.H{"message": "Cart cleared successfully"})
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
