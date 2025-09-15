const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
app.use(bodyParser.json());

// DB 연결 (환경변수는 Vercel 대시보드에 등록)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
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
    apis: [__filename], // 현재 파일만 읽게 변경
  };

const swaggerSpec = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API
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
  const [rows] = await pool.query("SELECT * FROM users");
  res.json(rows);
});

app.post("/users", async (req, res) => {
  const { name, email } = req.body;
  const [result] = await pool.query(
    "INSERT INTO users (name, email) VALUES (?, ?)",
    [name, email]
  );
  res.json({ id: result.insertId, name, email });
});

// Vercel은 핸들러 export 필요
module.exports = app;
