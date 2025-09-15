const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
app.use(bodyParser.json());

// DB 연결
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Swagger 설정
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MyCoffee API",
      version: "1.0.0",
      description: "커피 추천 서비스 회원가입/인증 API",
    },
  },
  apis: [__filename],
};
const swaggerSpec = swaggerJsdoc(options);

app.get("/swagger.json", (req, res) => res.json(swaggerSpec));

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
            SwaggerUIBundle({ url: '/swagger.json', dom_id: '#swagger-ui' });
          };
        </script>
      </body>
    </html>
  `);
});

/**
 * @openapi
 * /phone/request:
 *   post:
 *     summary: 휴대폰 인증번호 발송
 *     description: DB 프로시저(PRC_COF_PHONE_REQUEST)를 호출하여 인증번호를 발송합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone_number:
 *                 type: string
 *                 example: 01012345678
 *               purpose:
 *                 type: string
 *                 enum: [SIGNUP, LOGIN, FIND_ID]
 *                 example: SIGNUP
 *     responses:
 *       200:
 *         description: 인증번호 발송 결과
 */
app.post("/phone/request", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { phone_number, purpose } = req.body;
    const [result] = await conn.query(
      "EXEC PRC_COF_PHONE_REQUEST @p_phone_number=?, @p_purpose=?",
      [phone_number, purpose || "SIGNUP"]
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * @openapi
 * /phone/verify:
 *   post:
 *     summary: 휴대폰 인증번호 확인
 *     description: DB 프로시저(PRC_COF_PHONE_VERIFY)를 호출하여 인증번호를 검증합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone_number:
 *                 type: string
 *                 example: 01012345678
 *               verification_code:
 *                 type: string
 *                 example: 123456
 *               purpose:
 *                 type: string
 *                 enum: [SIGNUP, LOGIN, FIND_ID]
 *                 example: SIGNUP
 *     responses:
 *       200:
 *         description: 인증 확인 결과
 */
app.post("/phone/verify", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { phone_number, verification_code, purpose } = req.body;
    const [result] = await conn.query(
      "EXEC PRC_COF_PHONE_VERIFY @p_phone_number=?, @p_verification_code=?, @p_purpose=?",
      [phone_number, verification_code, purpose || "SIGNUP"]
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * @openapi
 * /signup:
 *   post:
 *     summary: 회원가입
 *     description: DB 프로시저(PRC_COF_USER_SIGNUP)를 호출하여 신규 회원을 생성합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               validation_mode:
 *                 type: string
 *                 enum: [EMAIL_ONLY, PASSWORD_ONLY, PHONE_ONLY, NAME_ONLY, FULL_SIGNUP]
 *                 example: FULL_SIGNUP
 *               email:
 *                 type: string
 *                 example: coffeeuser@example.com
 *               password:
 *                 type: string
 *                 example: Coffee1234
 *               name:
 *                 type: string
 *                 example: 김커피
 *               birth_year:
 *                 type: integer
 *                 example: 1990
 *               birth_date:
 *                 type: string
 *                 format: date
 *                 example: 1990-05-01
 *               gender:
 *                 type: string
 *                 enum: [M, F]
 *                 example: M
 *               phone_number:
 *                 type: string
 *                 example: 01012345678
 *               verification_code:
 *                 type: string
 *                 example: 123456
 *               terms_agreed:
 *                 type: boolean
 *                 example: true
 *               privacy_agreed:
 *                 type: boolean
 *                 example: true
 *               marketing_agreed:
 *                 type: boolean
 *                 example: false
 *               ip_address:
 *                 type: string
 *                 example: 127.0.0.1
 *               user_agent:
 *                 type: string
 *                 example: Test Script
 *               device_type:
 *                 type: string
 *                 enum: [WEB, MOBILE_ANDROID, MOBILE_IOS]
 *                 example: WEB
 *               device_id:
 *                 type: string
 *                 example: TEST-DEVICE
 *               app_version:
 *                 type: string
 *                 example: 1.0
 *     responses:
 *       200:
 *         description: 회원가입 결과
 */
app.post("/signup", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const input = req.body;
    const [result] = await conn.query(
      `EXEC PRC_COF_USER_SIGNUP 
        @p_validation_mode=?, @p_email=?, @p_password=?, @p_name=?, 
        @p_birth_year=?, @p_birth_date=?, @p_gender=?, 
        @p_phone_number=?, @p_verification_code=?, 
        @p_terms_agreed=?, @p_privacy_agreed=?, @p_marketing_agreed=?, 
        @p_ip_address=?, @p_user_agent=?, @p_device_type=?, 
        @p_device_id=?, @p_app_version=?`,
      [
        input.validation_mode,
        input.email,
        input.password,
        input.name,
        input.birth_year,
        input.birth_date,
        input.gender,
        input.phone_number,
        input.verification_code,
        input.terms_agreed,
        input.privacy_agreed,
        input.marketing_agreed,
        input.ip_address,
        input.user_agent,
        input.device_type,
        input.device_id,
        input.app_version,
      ]
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = app;
