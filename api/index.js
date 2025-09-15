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
      input: req.body,
      output: result.output || {},
      recordset: result.recordset || [],
      rowsAffected: result.rowsAffected || []
    });
  } catch (err) {
    console.error("❌ /phone/request error:", err);
    res.status(500).json({
      error: true,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
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
      input: req.body,
      output: result.output || {},
      recordset: result.recordset || [],
      rowsAffected: result.rowsAffected || []
    });
  } catch (err) {
    console.error("❌ /phone/verify error:", err);
    res.status(500).json({
      error: true,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
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
      input: req.body,
      output: result.output || {},
      recordset: result.recordset || [],
      rowsAffected: result.rowsAffected || []
    });
  } catch (err) {
    console.error("❌ /signup error:", err);
    res.status(500).json({
      error: true,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
});

module.exports = app;
