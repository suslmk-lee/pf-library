package main

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var (
	userServiceAddr string
	bookServiceAddr string
	cartServiceAddr string
)

func main() {
	// .env.local 파일 로드 (파일이 없어도 에러 무시)
	if err := godotenv.Load("../../.env.local"); err != nil {
		log.Println("No .env.local file found, using environment variables or defaults")
	}

	// 환경 변수 읽기 (로컬 개발용 또는 Istio 서비스 메시 FQDN 사용)
	userServiceAddr = getEnv("USER_SERVICE_ADDR", "http://localhost:8081")
	bookServiceAddr = getEnv("BOOK_SERVICE_ADDR", "http://localhost:8082")
	cartServiceAddr = getEnv("CART_SERVICE_ADDR", "http://localhost:8083")

	log.Printf("User Service: %s", userServiceAddr)
	log.Printf("Book Service: %s", bookServiceAddr)
	log.Printf("Cart Service: %s", cartServiceAddr)

	// Gin 라우터 설정
	router := gin.Default()

	// CORS 설정
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// API 라우팅
	// Users 서비스
	router.Any("/api/users", func(c *gin.Context) {
		proxyRequest(c, userServiceAddr, "/api/users", "")
	})
	router.Any("/api/users/*path", func(c *gin.Context) {
		proxyRequest(c, userServiceAddr, "/api/users", "")
	})

	// Books 서비스
	router.Any("/api/books", func(c *gin.Context) {
		proxyRequest(c, bookServiceAddr, "/api/books", "/books")
	})
	router.Any("/api/books/*path", func(c *gin.Context) {
		proxyRequest(c, bookServiceAddr, "/api/books", "/books")
	})

	// Cart 서비스
	router.Any("/api/cart", func(c *gin.Context) {
		proxyRequest(c, cartServiceAddr, "/api/cart", "/cart")
	})
	router.Any("/api/cart/*path", func(c *gin.Context) {
		proxyRequest(c, cartServiceAddr, "/api/cart", "/cart")
	})

	// 서버 시작
	port := getEnv("API_GATEWAY_PORT", getEnv("PORT", "8080"))
	log.Printf("API Gateway starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func proxyRequest(c *gin.Context, targetService, stripPrefix, addPrefix string) {
	// 경로 변환
	path := c.Param("path")
	if stripPrefix != "" {
		path = strings.TrimPrefix(c.Request.URL.Path, stripPrefix)
	}
	targetURL := targetService + addPrefix + path
	if c.Request.URL.RawQuery != "" {
		targetURL += "?" + c.Request.URL.RawQuery
	}

	log.Printf("Proxying %s %s -> %s", c.Request.Method, c.Request.URL.Path, targetURL)

	// 요청 본문 읽기
	var bodyBytes []byte
	if c.Request.Body != nil {
		bodyBytes, _ = io.ReadAll(c.Request.Body)
	}

	// 새 요청 생성
	req, err := http.NewRequest(c.Request.Method, targetURL, bytes.NewReader(bodyBytes))
	if err != nil {
		log.Printf("Failed to create request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	// 헤더 복사
	for key, values := range c.Request.Header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	// 요청 전송
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Service unavailable"})
		return
	}
	defer resp.Body.Close()

	// 응답 본문 읽기
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	// 응답 헤더 복사 (CORS 헤더는 제외, API Gateway에서 이미 설정함)
	corsHeaders := map[string]bool{
		"Access-Control-Allow-Origin":      true,
		"Access-Control-Allow-Credentials": true,
		"Access-Control-Allow-Headers":     true,
		"Access-Control-Allow-Methods":     true,
	}

	for key, values := range resp.Header {
		// CORS 헤더는 건너뛰기
		if corsHeaders[key] {
			continue
		}
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}

	// 응답 전송
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), respBody)
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
