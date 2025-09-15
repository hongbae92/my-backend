const express = require("express");
const bodyParser = require("body-parser");
const sql = require("mssql");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
app.use(bodyParser.json());

// DB 연결 설정 (SQL Server)
const pool = new sql.ConnectionPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  options: {
    encrypt: false, // Azure 등 클라우드면 true
    trustServerCertificate: true,
  },
});

pool.connect()
  .then(() => console.log("✅ DB Connected"))
  .catch(err => console.error("❌ DB Connection Failed:", err));

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
 */
app.post("/phone/request", async (req, res) => {
  try {
    const { phone_number, purpose } = req.body;
    const request = pool.request();
    request.input("p_phone_number", sql.VarChar(20), phone_number);
    request.input("p_purpose", sql.VarChar(20), purpose || "SIGNUP");

    const result = await request.execute("PRC_COF_PHONE_REQUEST");
    res.json(result.recordset || result.output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /phone/verify:
 *   post:
 *     summary: 휴대폰 인증번호 확인
 *     description: DB 프로시저(PRC_COF_PHONE_VERIFY)를 호출하여 인증번호를 검증합니다.
 */
app.post("/phone/verify", async (req, res) => {
  try {
    const { phone_number, verification_code, purpose } = req.body;
    const request = pool.request();
    request.input("p_phone_number", sql.VarChar(20), phone_number);
    request.input("p_verification_code", sql.VarChar(6), verification_code);
    request.input("p_purpose", sql.VarChar(20), purpose || "SIGNUP");

    const result = await request.execute("PRC_COF_PHONE_VERIFY");
    res.json(result.recordset || result.output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /signup:
 *   post:
 *     summary: 회원가입
 *     description: DB 프로시저(PRC_COF_USER_SIGNUP)를 호출하여 신규 회원을 생성합니다.
 */
app.post("/signup", async (req, res) => {
  try {
    const input = req.body;
    const request = pool.request();

    request.input("p_validation_mode", sql.VarChar(20), input.validation_mode);
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

    // 출력 파라미터
    request.output("p_user_id", sql.Int);
    request.output("p_session_id", sql.NVarChar(50));
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_USER_SIGNUP");

    res.json({
      user_id: result.output.p_user_id,
      session_id: result.output.p_session_id,
      result_code: result.output.p_result_code,
      result_message: result.output.p_result_message,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
