"""개발용 게이트웨이 — 프론트가 호출하는 Spring Boot 계약(/api/v1/analysis/*, 8080)을
로컬 FastAPI AI 서버(8000)에 경로만 바꿔 전달한다. Spring Boot 백엔드 리포가
준비되기 전까지 프론트단 로컬 개발·검증용으로 쓴다.

실행 (AI 리포 venv 필요 — fastapi, httpx):
  ../HUFS-Histock-AI/.venv/bin/uvicorn scripts.dev_gateway:app --port 8080
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import httpx

app = FastAPI(title="histock dev gateway")
TARGET = "http://127.0.0.1:8000"
ROUTES = {"health": "/health", "methods": "/api/methods", "search": "/api/search"}


@app.api_route("/api/v1/analysis/{name}", methods=["GET"])
async def forward(name: str, request: Request):
    path = ROUTES.get(name)
    if path is None:
        return JSONResponse(
            {"message": f"알 수 없는 엔드포인트: /api/v1/analysis/{name}"},
            status_code=404,
        )
    try:
        async with httpx.AsyncClient(base_url=TARGET, timeout=70) as client:
            upstream = await client.get(path, params=request.query_params)
    except httpx.HTTPError as error:
        return JSONResponse(
            {"message": f"AI 서버(8000)에 연결할 수 없습니다: {error}"},
            status_code=502,
        )
    try:
        return JSONResponse(upstream.json(), status_code=upstream.status_code)
    except ValueError:
        return JSONResponse(
            {"message": upstream.text[:200]}, status_code=upstream.status_code
        )
