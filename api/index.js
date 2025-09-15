const express = require("express");
const bodyParser = require("body-parser");
const sql = require("mssql");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
app.use(bodyParser.json());

// =========================
// 🔹 DB 풀 캐싱 (Vercel 최적화)
// =========================
let poolPromise;
async function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      server: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    });

    poolPromise = pool.connect()
      .then((p) => {
        console.log("✅ DB Connected");
        return p;
      })
      .catch((err) => {
        poolPromise = null;
        console.error("❌ DB Connection Failed:", err);
        throw err;
      });
  }
  return poolPromise;
}

// =========================
// 🔹 Swagger 설정
// =========================
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

// =========================
// 🔹 Health Check
// =========================
app.get("/health", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT GETDATE() as now");
    res.json({ status: "ok", now: result.recordset[0].now });
  } catch (err) {
    console.error("❌ /health error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// 🔹 Phone Request
// =========================
/**
 * @openapi
 * /phone/request:
 *   post:
 *     summary: 휴대폰 인증번호 발송
 *     description: |
 *       - **회원가입(SIGNUP)**: `user_id`는 반드시 null  
 *       - **기존 회원**: 실제 DB에 존재하는 user_id 필요  
 *       - 잘못된 user_id를 넣으면 Foreign Key 오류 발생
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone_number:
 *                 type: string
 *                 description: "사용자 휴대폰 번호 (예: 01012345678)"
 *                 example: "01012345678"
 *               purpose:
 *                 type: string
 *                 description: "인증 목적 (SIGNUP=회원가입, PASSWORD_RESET=비밀번호 재설정)"
 *                 example: "SIGNUP"
 *               user_id:
 *                 type: integer
 *                 description: "기존 회원일 경우 DB에 존재하는 user_id, 신규 회원가입 시 null"
 *                 example: null
 *     responses:
 *       200:
 *         description: 인증번호 발송 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 output:
 *                   type: object
 *                   properties:
 *                     p_verification_code:
 *                       type: string
 *                       example: "426440"
 *                     p_result_code:
 *                       type: string
 *                       enum: [SUCCESS, INVALID_PHONE, TOO_MANY_REQUESTS, PHONE_DUPLICATE, ERROR]
 *                       example: SUCCESS
 *                     p_result_message:
 *                       type: string
 *                       example: "인증번호가 발송되었습니다."
 *                 recordset:
 *                   type: array
 *                   items: {}
 *                 rowsAffected:
 *                   type: array
 *                   items: {}
 */
app.post("/phone/request", async (req, res) => {
  try {
    const pool = await getPool();
    const { phone_number, purpose, user_id } = req.body;
    const request = pool.request();
    request.input("p_phone_number", sql.VarChar(20), phone_number);
    request.input("p_purpose", sql.VarChar(20), purpose || "SIGNUP");
    request.input("p_user_id", sql.Int, user_id || null);

    request.output("p_verification_code", sql.VarChar(6));
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_PHONE_REQUEST");

    res.json({
      output: result.output || {},
      recordset: result.recordset || [],
      rowsAffected: result.rowsAffected || [],
    });
  } catch (err) {
    console.error("❌ /phone/request error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// 🔹 Phone Verify
// =========================
/**
 * @openapi
 * /phone/verify:
 *   post:
 *     summary: 휴대폰 인증번호 확인
 *     description: |
 *       발송받은 인증번호(`verification_code`)를 입력해 검증합니다.  
 *       - 인증번호가 일치하면 `p_result_code = SUCCESS`  
 *       - 틀리면 `ERROR` 반환
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone_number:
 *                 type: string
 *                 description: "인증받은 휴대폰 번호"
 *                 example: "01012345678"
 *               verification_code:
 *                 type: string
 *                 description: "발송받은 6자리 인증번호"
 *                 example: "123456"
 *               purpose:
 *                 type: string
 *                 description: "인증 목적 (기본값 SIGNUP)"
 *                 example: "SIGNUP"
 *     responses:
 *       200:
 *         description: 인증번호 확인 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 output:
 *                   type: object
 *                   properties:
 *                     p_verification_id:
 *                       type: integer
 *                       example: 6
 *                     p_result_code:
 *                       type: string
 *                       enum: [SUCCESS, NO_VERIFICATION, EXPIRED, TOO_MANY_ATTEMPTS, INVALID_CODE, ERROR]
 *                       example: SUCCESS
 *                     p_result_message:
 *                       type: string
 *                       example: "휴대폰 인증이 완료되었습니다."
 *                 recordset:
 *                   type: array
 *                   items: {}
 *                 rowsAffected:
 *                   type: array
 *                   items: {}
 */
app.post("/phone/verify", async (req, res) => {
  try {
    const pool = await getPool();
    const { phone_number, verification_code, purpose } = req.body;
    const request = pool.request();
    request.input("p_phone_number", sql.VarChar(20), phone_number);
    request.input("p_verification_code", sql.VarChar(6), verification_code);
    request.input("p_purpose", sql.VarChar(20), purpose || "SIGNUP");

    request.output("p_verification_id", sql.Int);
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_PHONE_VERIFY");

    res.json({
      output: result.output || {},
      recordset: result.recordset || [],
      rowsAffected: result.rowsAffected || [],
    });
  } catch (err) {
    console.error("❌ /phone/verify error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// 🔹 Signup
// =========================
/**
 * @openapi
 * /signup:
 *   post:
 *     summary: 회원가입
 *     description: |
 *       - 휴대폰 인증이 완료된 후 진행해야 합니다.  
 *       - 필수값: `email`, `password`, `name`, `phone_number`, `verification_code`, 약관동의(`terms_agreed`, `privacy_agreed`)  
 *       - `validation_mode`는 기본 "FULL_SIGNUP"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               validation_mode:
 *                 type: string
 *                 example: "FULL_SIGNUP"
 *               email:
 *                 type: string
 *                 example: "coffeeuser@example.com"
 *               password:
 *                 type: string
 *                 example: "Coffee1234"
 *               name:
 *                 type: string
 *                 example: "김커피"
 *               birth_year:
 *                 type: integer
 *                 example: 1990
 *               birth_date:
 *                 type: string
 *                 format: date
 *                 example: "1990-05-01"
 *               gender:
 *                 type: string
 *                 example: "M"
 *               phone_number:
 *                 type: string
 *                 example: "01012345678"
 *               verification_code:
 *                 type: string
 *                 example: "123456"
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
 *                 example: "127.0.0.1"
 *               user_agent:
 *                 type: string
 *                 example: "Swagger Test"
 *               device_type:
 *                 type: string
 *                 example: "WEB"
 *               device_id:
 *                 type: string
 *                 example: "TEST-DEVICE"
 *               app_version:
 *                 type: string
 *                 example: "1.0"
 *     responses:
 *       200:
 *         description: 회원가입 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 output:
 *                   type: object
 *                   properties:
 *                     p_user_id:
 *                       type: integer
 *                       example: 101
 *                     p_session_id:
 *                       type: string
 *                       example: "b3f5d97a-9c3e-4a28-bc7c-2d4b3a..."
 *                     p_result_code:
 *                       type: string
 *                       enum: [SUCCESS, MISSING_REQUIRED, TERMS_NOT_AGREED, PHONE_NOT_VERIFIED, EMAIL_DUPLICATE, PHONE_DUPLICATE, INVALID_EMAIL, INVALID_PHONE, INVALID_PASSWORD, PASSWORD_FORMAT, INVALID_NAME, ERROR]
 *                       example: SUCCESS
 *                     p_result_message:
 *                       type: string
 *                       example: "회원가입이 완료되었습니다."
 *                 recordset:
 *                   type: array
 *                   items: {}
 *                 rowsAffected:
 *                   type: array
 *                   items: {}
 */
app.post("/signup", async (req, res) => {
  try {
    const pool = await getPool();
    const input = req.body;
    const request = pool.request();

    request.input("p_validation_mode", sql.VarChar(20), input.validation_mode || "FULL_SIGNUP");
    request.input("p_email", sql.NVarChar(255), input.email);
    request.input("p_password", sql.VarChar(255), input.password);
    request.input("p_name", sql.NVarChar(100), input.name);
    request.input("p_birth_year", sql.Int, input.birth_year);
    request.input("p_birth_date", sql.Date, input.birth_date);
    request.input("p_gender", sql.Char(1), input.gender);
    request.input("p_phone_number", sql.VarChar(20), input.phone_number);
    request.input("p_verification_code", sql.VarChar(6), input.verification_code);
    request.input("p_terms_agreed", sql.Bit, input.terms_agreed);
    request.input("p_privacy_agreed", sql.Bit, input.privacy_agreed);
    request.input("p_marketing_agreed", sql.Bit, input.marketing_agreed);
    request.input("p_ip_address", sql.VarChar(45), input.ip_address);
    request.input("p_user_agent", sql.NVarChar(sql.MAX), input.user_agent);
    request.input("p_device_type", sql.VarChar(20), input.device_type);
    request.input("p_device_id", sql.NVarChar(100), input.device_id);
    request.input("p_app_version", sql.VarChar(20), input.app_version);

    request.output("p_user_id", sql.Int);
    request.output("p_session_id", sql.NVarChar(50));
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_USER_SIGNUP");

    res.json({
      output: result.output || {},
      recordset: result.recordset || [],
      rowsAffected: result.rowsAffected || [],
    });
  } catch (err) {
    console.error("❌ /signup error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
