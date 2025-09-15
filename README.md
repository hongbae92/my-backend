# My Backend

## 실행 방법
1. 패키지 설치
```bash
npm install
```

2. 서버 실행
```bash
npm start
```

3. Swagger UI 접속
```
http://localhost:3000/api-docs
```

## 환경변수 (.env)
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=1234
DB_NAME=mydb
```

## 테스트 API
- GET `/users` → 사용자 목록 조회
- POST `/users` → 사용자 추가 (name, email 필요)
