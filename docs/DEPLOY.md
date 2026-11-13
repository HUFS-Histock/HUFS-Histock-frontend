# 배포 · 백엔드 연동 가이드

프론트(Vercel) → 백엔드(Render 등) → 연결(vercel.json rewrites) 3단계 구조.
GitHub Actions 워크플로우는 필요 없다 — Vercel은 Git 연동으로 main push마다 자동 배포하고,
PR마다 프리뷰 URL을 만든다.

## 1. 프론트 — Vercel

1. vercel.com 에서 GitHub 계정으로 가입 (조직 리포가 안 보이면 GitHub App 권한 조정)
2. Add New → Project → `HUFS-Histock-frontend` import
3. 설정은 자동 감지(Vite / `npm run build` / `dist`) — 그대로 Deploy
4. `https://_histock.vercel.app` 형식 URL 발급. 이후 main push → 자동 배포

로컬과 동일 Node 버전은 `.node-version`(24)로 맞춰 둔다.

## 2. 백엔드 연동 구조

프론트는 `/api/v1/...` **상대경로**로만 호출한다(`src/lib/api.ts`).

- **개발**: vite proxy가 `localhost:8080`으로 전달 (`vite.config.ts`)
- **프로덕션(Vercel)**: `vercel.json` rewrites가 백엔드 공인 URL로 프록시

백엔드 URL이 정해지면 루트에 `vercel.json` 생성:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://백엔드URL/api/$1" }
  ]
}
```

- 프론트 코드 수정 **0** — 브라우저는 자기 origin(`/api`)을 호출하고 Vercel 엣지가 백엔드로 넘긴다.
- 백엔드 측 **CORS 설정도 불필요** (요청이 브라우저 → 백엔드로 직행하지 않으므로).
- 임시 테스트: `cloudflared tunnel --url http://localhost:8080` 로 로컬 백엔드에
  임시 공인 URL을 만들어 destination에 넣어볼 수 있다 (터널 종료 시 URL 만료).

## 3. 백엔드 — Render 무료 배포 체크리스트

1. render.com → New → Web Service → `HUFS-Histock-AI` 리포 연결, Free 티어
2. Build: `pip install -r requirements.txt` / Start: uvicorn 등 (프레임워크 확인)
3. **포트**: Render는 `PORT` 환경변수로 지정 — 하드코딩 8080이면 `$PORT` 읽도록 수정
4. **모델 파일**: 학습 산출물이 리포에 커밋돼 있어야 서버에서 로드 가능 (대용량이면 Git LFS)
5. **슬립**: Free는 15분 미사용 시 꺼지고 첫 요청이 30~60초 걸림 — 프론트 타임아웃이
   70초(`src/lib/api.ts` `request()`)라 깨어나는 걸 기다려 준다

## 4. 데이터 경계 (배포본에 보이는 것)

[디자인 기록](design/HANDOFF.md) 기준:

- **가격 시계열 API(F-013)는 미구현.** 스냅숏(`public/snapshot.json`)에 있는 구간만
  캔들·거래량으로 보이고, 없는 날짜는 분석 응답의 상대 수익률 선(D+ n)만 표시한다.
- `snapshot.json`은 gitignored — 저장소에는 없다. Vercel 기본 배포엔 시세 데이터가 없어
  차트가 비어 있어도 정상이다. 데모로 포함하려면 생성 후 커밋(`.gitignore` 조정):
  실 데이터는 `npm run snapshot`(AI 리포 필요), 검증용 합성 데이터는
  `node scripts/make-test-snapshot.mjs`.
- 저장 예시 분석은 **명시적 선택 시에만** 라이브 결과를 대체한다 (자동 폴백 없음).

## 5. 로컬 풀스택 실행 (백엔드 연동 검증)

AI 서버 리포(`../HUFS-Histock-AI`)와 함께 띄운다. Spring Boot 게이트웨이 리포가
준비되기 전에는 `scripts/dev_gateway.py`가 8080의 `/api/v1/analysis/*` 계약을
FastAPI(8000)에 연결해 준다. 2026-11-13 이 구성으로 e2e 9개 전체 통과 확인.

```bash
cd ../HUFS-Histock-AI
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m src.ops.update          # 데이터 수집·정렬·윈도우 (인터넷, 수 분)
.venv/bin/uvicorn src.api.main:app --port 8000          # 터미널 1: AI 서버
cd ../Histock
../HUFS-Histock-AI/.venv/bin/uvicorn scripts.dev_gateway:app --port 8080   # 터미널 2: 게이트웨이
npm run snapshot                             # 실데이터 스냅숏 (public/snapshot.json, gitignored)
npm run dev                                  # 터미널 3: 프론트 → http://localhost:5173
```

## 6. 로컬 e2e

- **백엔드 없이**: `node scripts/make-test-snapshot.mjs` 로 합성 스냅숏을 만들면
  스냅숏 기반 테스트 3개(오프라인 폴백 · 팬/날짜 축 · 줌 애니메이션)를 돌릴 수 있다:

  ```
  node scripts/make-test-snapshot.mjs
  npx playwright test --grep "offline|horizontal pan|zoom animates"
  ```

- **풀스택**: 위 5절의 서버를 띄운 뒤 `npm run snapshot`으로 실 스냅숏을 만들고
  `npx playwright test` — 9개 전부 통과해야 한다. 날짜 관련 기대값은 스냅숏
  데이터에서 계산하므로 매일 갱신돼도 깨지지 않는다.

  ⚠️ 합성 스냅숏(make-test-snapshot)을 만든 적이 있으면 풀스택 실행 전에 반드시
  `npm run snapshot`으로 실 스냅숏을 다시 만들 것. 합성(dataDate 고정)과 실데이터의
  날짜가 어긋나면 실제 분석 결과가 도착하는 순간 차트가 빈 상태로 바뀌며 e2e가 깨진다.
