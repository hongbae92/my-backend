const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// DB 연결 풀
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Swagger 옵션
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My API",
      version: "1.0.0",
      description: "Node.js + Express + Swagger + MySQL 샘플 API"
    },
  },
  apis: ["./server.js"],
};

const swaggerSpec = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

// 서버 실행
app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
  console.log("✅ Swagger Docs: http://localhost:3000/api-docs");
});