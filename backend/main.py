from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ai_service import (
    verify_competitors,
    aggregate_scrape,
    process_and_validate_features,
    search_competitors_context
)

app = FastAPI()

# allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models for the API JSON bodies
class VerifyRequest(BaseModel):
    competitors: List[Dict[str, Any]]

class ScrapeRequest(BaseModel):
    name: str
    url: str

class SearchCompetitorsRequest(BaseModel):
    product_name: str
    product_description: str

class ValidateFeaturesRequest(BaseModel):
    features: List[Dict[str, str]]
    competitor_url: str

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/verify-competitors")
async def api_verify_competitors(req: VerifyRequest):
    # Instead of temporary mock, we plug in the real verification!
    verified_list = await verify_competitors(req.competitors)
    return {"verified": verified_list}

@app.post("/api/scrape")
async def api_scrape(req: ScrapeRequest):
    content = await aggregate_scrape(req.name, req.url)
    return {"content": content}

@app.post("/api/search-competitors")
async def api_search_competitors(req: SearchCompetitorsRequest):
    context = await search_competitors_context(req.product_name, req.product_description)
    return {"context": context}

@app.post("/api/validate-features")
async def api_validate_features(req: ValidateFeaturesRequest):
    cleaned = await process_and_validate_features(req.features, req.competitor_url)
    return {"cleaned_features": cleaned}

# Kept exactly as requested in case you test with it elsewhere
@app.post("/api/extract-features")
def extract_features(data: list):
    return {"message": "backend connected", "data": data}
