const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
app.use(bodyParser.json());

// DB 연결 (환경변수는 Vercel 대시보드에 등록)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,   // 포트 추가
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

// Swagger 설정
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My API",
      version: "1.0.0",
    },
  },
  apis: [__filename], // 현재 파일을 기준으로 주석 읽기
};

const swaggerSpec = swaggerJsdoc(options);

// Swagger JSON 출력 (디버깅/연동용)
app.get("/swagger.json", (req, res) => {
  res.json(swaggerSpec);
});

// Swagger UI (CDN 방식)
app.get("/docs", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Swagger UI</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
        <script>
          window.onload = () => {
            SwaggerUIBundle({
              url: '/swagger.json',
              dom_id: '#swagger-ui'
            });
          };
        </script>
      </body>
    </html>
  `);
});

/**
 * @openapi
 * /users:
 *   get:
 *     summary: 모든 사용자 조회
 *     responses:
 *       200:
 *         description: 사용자 목록 반환
 *   post:
 *     summary: 사용자 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: 생성된 사용자 반환
 */
app.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/users", async (req, res) => {
  try {
    const { name, email } = req.body;
    const [result] = await pool.query(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      [name, email]
    );
    res.json({ id: result.insertId, name, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vercel은 핸들러 export 필요
module.exports = app;
