import logging

from fastapi import FastAPI

from app.api import routes_admin, routes_health, routes_index, routes_search

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="EngineerBrain AI Service")

app.include_router(routes_health.router)
app.include_router(routes_index.router)
app.include_router(routes_search.router)
app.include_router(routes_admin.router)
