"""
Sports Trading Agent — FastAPI server.

Run with:
    uvicorn api:app --reload --port 8000

Endpoints:
    POST /pregame   — load game memory before tip-off
    POST /live      — process a play and return trading signals
    POST /backtest  — replay a historical game with signals
    GET  /positions — current portfolio state
    GET  /health
"""

import os
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

if not os.environ.get("GOOGLE_API_KEY"):
    try:
        with open(".envrc") as f:
            for line in f:
                line = line.strip()
                if line.startswith("export "):
                    line = line[len("export "):]
                if "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass

if not os.environ.get("GOOGLE_API_KEY"):
    raise RuntimeError(
        "GOOGLE_API_KEY is not set. Add it to .env or export it before starting the server."
    )

import positions_manager
from routes.pregame import router as pregame_router
from routes.live import router as live_router
from routes.backtest import router as backtest_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✓ API ready — /pregame  /live  /backtest  /positions")
    yield


app = FastAPI(
    title="Sports Trading Agent",
    description="Live college basketball trading agent with Kalshi integration.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pregame_router)
app.include_router(live_router)
app.include_router(backtest_router)


@app.get("/positions")
async def get_positions():
    """Current portfolio: buying power, open positions, trade history."""
    return positions_manager.load()


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
