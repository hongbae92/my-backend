const express = require("express");
const bodyParser = require("body-parser");
const sql = require("mssql");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

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
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "☕ MyCoffee.AI API",
      version: "1.0.0",
      description: "회원/인증/추천 관련 Stored Procedure API 문서",
    },
    servers: [{ url: "http://localhost:3000" }],
  },
  apis: [__filename],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * components:
 *   schemas:
 *     SignupRequest:
 *       type: object
 *       required: [email, password, name, phone_number, verification_code, terms_agreed, privacy_agreed]
 *       properties:
 *         email:
 *           type: string
 *           example: user@example.com
 *           description: 회원 이메일
 *         password:
 *           type: string
 *           example: P@ssw0rd!
 *           description: 8~20자의 영문+숫자 비밀번호
 *         name:
 *           type: string
 *           example: 홍길동
 *           description: 회원 이름
 *         birth_year:
 *           type: integer
 *           example: 1990
 *           description: 출생 연도
 *         birth_date:
 *           type: string
 *           format: date
 *           example: 1990-05-20
 *           description: 출생일
 *         gender:
 *           type: string
 *           enum: [M, F]
 *           example: M
 *           description: 성별 (M/F)
 *         phone_number:
 *           type: string
 *           example: 01012345678
 *           description: 휴대폰 번호
 *         verification_code:
 *           type: string
 *           example: 123456
 *           description: 휴대폰 인증번호
 *         terms_agreed:
 *           type: boolean
 *           example: true
 *           description: 서비스 이용약관 동의 여부
 *         privacy_agreed:
 *           type: boolean
 *           example: true
 *           description: 개인정보 처리방침 동의 여부
 *         marketing_agreed:
 *           type: boolean
 *           example: false
 *           description: 마케팅 수신 동의 여부 (선택)
 *
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           example: user@example.com
 *         password:
 *           type: string
 *           example: P@ssw0rd!
 *         auto_login:
 *           type: boolean
 *           example: false
 *
 *     RecommendRequest:
 *       type: object
 *       required: [aroma, acidity, nutty, body, sweetness]
 *       properties:
 *         aroma: { type: integer, example: 3, description: 향 점수 (0~5) }
 *         acidity: { type: integer, example: 2, description: 신맛 점수 (0~5) }
 *         nutty: { type: integer, example: 4, description: 고소함 점수 (0~5) }
 *         body: { type: integer, example: 3, description: 바디감 점수 (0~5) }
 *         sweetness: { type: integer, example: 1, description: 단맛 점수 (0~5) }
 *         user_id: { type: integer, example: 101, description: 사용자 ID (선택) }
 *
 *     PhoneRequest:
 *       type: object
 *       required: [phone_number]
 *       properties:
 *         phone_number: { type: string, example: 01012345678 }
 *         purpose: { type: string, enum: [SIGNUP, LOGIN, FIND_ID], example: SIGNUP }
 *         user_id: { type: integer, example: 101 }
 *
 *     PhoneVerifyRequest:
 *       type: object
 *       required: [phone_number, verification_code]
 *       properties:
 *         phone_number: { type: string, example: 01012345678 }
 *         verification_code: { type: string, example: 123456 }
 *         purpose: { type: string, example: SIGNUP }
 *
 *     ResetPasswordRequest:
 *       type: object
 *       required: [email, phone_number, verification_code, new_password, new_password_confirm]
 *       properties:
 *         email: { type: string, example: user@example.com }
 *         phone_number: { type: string, example: 01012345678 }
 *         verification_code: { type: string, example: 123456 }
 *         new_password: { type: string, example: NewP@ssw0rd }
 *         new_password_confirm: { type: string, example: NewP@ssw0rd }
 */

// =========================
// 🔹 Stored Procedure APIs
// =========================

/**
 * @swagger
 * /api/signup:
 *   post:
 *     summary: 회원가입
 *     description: 이메일/비밀번호/휴대폰 인증 기반으로 새로운 회원을 등록합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/SignupRequest" }
 *     responses:
 *       200:
 *         description: 성공/실패 코드와 메시지 반환
 *         content:
 *           application/json:
 *             example:
 *               p_result_code: "SUCCESS"
 *               p_result_message: "회원가입이 완료되었습니다."
 *               p_user_id: 101
 *               p_session_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 */
app.post("/api/signup", async (req, res) => {
  const pool = await getPool();
  const {
    email, password, name, birth_year, birth_date, gender,
    phone_number, verification_code,
    terms_agreed, privacy_agreed, marketing_agreed,
    ip_address, user_agent, device_type, device_id, app_version,
  } = req.body;

  try {
    const request = pool.request();
    request.input("p_validation_mode", sql.VarChar(20), "FULL_SIGNUP");
    request.input("p_email", sql.NVarChar(255), email);
    request.input("p_password", sql.VarChar(255), password);
    request.input("p_name", sql.NVarChar(100), name);
    request.input("p_birth_year", sql.Int, birth_year);
    request.input("p_birth_date", sql.Date, birth_date);
    request.input("p_gender", sql.Char(1), gender);
    request.input("p_phone_number", sql.VarChar(20), phone_number);
    request.input("p_verification_code", sql.VarChar(6), verification_code);
    request.input("p_terms_agreed", sql.Bit, terms_agreed);
    request.input("p_privacy_agreed", sql.Bit, privacy_agreed);
    request.input("p_marketing_agreed", sql.Bit, marketing_agreed);
    request.input("p_ip_address", sql.VarChar(45), ip_address);
    request.input("p_user_agent", sql.NText, user_agent);
    request.input("p_device_type", sql.VarChar(20), device_type);
    request.input("p_device_id", sql.NVarChar(100), device_id);
    request.input("p_app_version", sql.VarChar(20), app_version);

    request.output("p_user_id", sql.Int);
    request.output("p_session_id", sql.NVarChar(50));
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_USER_SIGNUP");
    res.json(result.output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/login/email:
 *   post:
 *     summary: 이메일 로그인
 *     description: 이메일과 비밀번호를 검증하고 세션을 생성합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/LoginRequest" }
 *     responses:
 *       200:
 *         description: 로그인 결과
 *         content:
 *           application/json:
 *             example:
 *               p_result_code: "SUCCESS"
 *               p_result_message: "로그인이 완료되었습니다."
 *               p_user_id: 101
 *               p_session_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 */
app.post("/api/login/email", async (req, res) => {
  const pool = await getPool();
  const { email, password, auto_login, ip_address, user_agent, device_type, device_id, app_version } = req.body;

  try {
    const request = pool.request();
    request.input("p_email", sql.NVarChar(255), email);
    request.input("p_password", sql.VarChar(255), password);
    request.input("p_auto_login", sql.Bit, auto_login || 0);
    request.input("p_ip_address", sql.VarChar(45), ip_address);
    request.input("p_user_agent", sql.NText, user_agent);
    request.input("p_device_type", sql.VarChar(20), device_type);
    request.input("p_device_id", sql.NVarChar(100), device_id);
    request.input("p_app_version", sql.VarChar(20), app_version);

    request.output("p_user_id", sql.Int);
    request.output("p_session_id", sql.NVarChar(50));
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_EMAIL_LOGIN");
    res.json(result.output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/recommend:
 *   post:
 *     summary: 커피 추천
 *     description: 유클리드 거리 기반으로 사용자 취향과 가장 가까운 5개 커피 블렌드를 추천합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/RecommendRequest" }
 *     responses:
 *       200:
 *         description: 추천 결과
 *         content:
 *           application/json:
 *             example:
 *               - coffee_blend_id: BLEND001
 *                 coffee_name: 벨벳 터치 블렌드
 *                 distance_score: 1.4142
 *                 aroma_score: 3
 *                 acidity_score: 2
 *                 nutty_score: 4
 *                 body_score: 3
 *                 sweetness_score: 1
 */
app.post("/api/recommend", async (req, res) => {
  const pool = await getPool();
  const { aroma, acidity, nutty, body, sweetness, user_id } = req.body;
  try {
    const request = pool.request();
    request.input("p_user_aroma", sql.Int, aroma);
    request.input("p_user_acidity", sql.Int, acidity);
    request.input("p_user_nutty", sql.Int, nutty);
    request.input("p_user_body", sql.Int, body);
    request.input("p_user_sweetness", sql.Int, sweetness);
    request.input("p_user_id", sql.Int, user_id || null);

    const result = await request.execute("PRC_COF_GET_RECO");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/phone/request:
 *   post:
 *     summary: 휴대폰 인증 요청
 *     description: 특정 목적(SIGNUP/LOGIN/FIND_ID)에 따라 인증번호를 발송합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/PhoneRequest" }
 *     responses:
 *       200:
 *         description: 인증 요청 결과
 *         content:
 *           application/json:
 *             example:
 *               p_result_code: "SUCCESS"
 *               p_result_message: "인증번호가 발송되었습니다."
 *               p_verification_code: "123456"
 */
app.post("/api/phone/request", async (req, res) => {
  const pool = await getPool();
  const { phone_number, purpose, user_id } = req.body;
  try {
    const request = pool.request();
    request.input("p_phone_number", sql.VarChar(20), phone_number);
    request.input("p_purpose", sql.VarChar(20), purpose || "SIGNUP");
    request.input("p_user_id", sql.Int, user_id || null);

    request.output("p_verification_code", sql.VarChar(6));
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_PHONE_REQUEST");
    res.json(result.output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/phone/verify:
 *   post:
 *     summary: 휴대폰 인증 확인
 *     description: 발송된 인증번호를 입력해 검증합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/PhoneVerifyRequest" }
 *     responses:
 *       200:
 *         description: 인증 결과
 *         content:
 *           application/json:
 *             example:
 *               p_result_code: "SUCCESS"
 *               p_result_message: "휴대폰 인증이 완료되었습니다."
 *               p_verification_id: 15
 */
app.post("/api/phone/verify", async (req, res) => {
  const pool = await getPool();
  const { phone_number, verification_code, purpose } = req.body;
  try {
    const request = pool.request();
    request.input("p_phone_number", sql.VarChar(20), phone_number);
    request.input("p_verification_code", sql.VarChar(6), verification_code);
    request.input("p_purpose", sql.VarChar(20), purpose || "SIGNUP");

    request.output("p_verification_id", sql.Int);
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_PHONE_VERIFY");
    res.json(result.output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/phone/request-find-id:
 *   post:
 *     summary: 아이디 찾기용 휴대폰 인증
 *     description: 등록된 휴대폰 번호를 통해 아이디 찾기 인증번호를 발송합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/PhoneRequest" }
 *     responses:
 *       200:
 *         description: 인증 결과
 *         content:
 *           application/json:
 *             example:
 *               p_result_code: "SUCCESS"
 *               p_result_message: "인증번호가 발송되었습니다."
 *               p_verification_code: "654321"
 */
app.post("/api/phone/request-find-id", async (req, res) => {
  const pool = await getPool();
  const { phone_number } = req.body;
  try {
    const request = pool.request();
    request.input("p_phone_number", sql.VarChar(20), phone_number);

    request.output("p_verification_code", sql.VarChar(6));
    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_PHONE_REQUEST_FIND_ID");
    res.json(result.output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/reset-password:
 *   post:
 *     summary: 비밀번호 재설정
 *     description: 이메일 + 휴대폰 인증번호 검증 후 새 비밀번호로 변경합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/ResetPasswordRequest" }
 *     responses:
 *       200:
 *         description: 비밀번호 재설정 결과
 *         content:
 *           application/json:
 *             example:
 *               p_result_code: "SUCCESS"
 *               p_result_message: "비밀번호 재설정이 완료되었습니다."
 */
app.post("/api/reset-password", async (req, res) => {
  const pool = await getPool();
  const { email, phone_number, verification_code, new_password, new_password_confirm } = req.body;
  try {
    const request = pool.request();
    request.input("p_email", sql.NVarChar(255), email);
    request.input("p_phone_number", sql.VarChar(20), phone_number);
    request.input("p_verification_code", sql.VarChar(6), verification_code);
    request.input("p_new_password", sql.VarChar(255), new_password);
    request.input("p_new_password_confirm", sql.VarChar(255), new_password_confirm);

    request.output("p_result_code", sql.VarChar(50));
    request.output("p_result_message", sql.NVarChar(255));

    const result = await request.execute("PRC_COF_RESET_PASSWORD");
    res.json(result.output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// 🔹 서버 시작
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
