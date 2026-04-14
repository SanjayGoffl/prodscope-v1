import httpx
import asyncio
import os
from urllib.parse import urlparse
from typing import List, Dict, Any

# ==========================================
# COMPETITOR VERIFICATION
# ==========================================

async def verify_url(url: str) -> bool:
    """Verifies that a URL is reachable and returns HTTP status 200."""
    if not url or not url.startswith('http'):
        return False
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
            response = await client.get(url, follow_redirects=True)
            return response.status_code == 200
    except Exception:
        return False

async def verify_competitors(competitors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Takes a list of competitors and verifies their URLs concurrently.
    Removes competitors with invalid URLs. Valid competitors get 'verified': True flag.
    """
    verified = []
    
    async def check_competitor(comp):
        is_valid = await verify_url(comp.get("url", ""))
        if is_valid:
            comp["verified"] = True
            verified.append(comp)

    tasks = [check_competitor(c) for c in competitors if c.get("name") and c.get("url")]
    
    if tasks:
        await asyncio.gather(*tasks)
    
    return verified

# ==========================================
# SCRAPING INTEGRATIONS
# ==========================================

async def scrape_with_tavily(query: str) -> str:
    """Extract information using Tavily API."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return ""
        
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "search_depth": "advanced",
                    "include_raw_content": True,
                    "max_results": 3
                }
            )
            data = response.json()
            results = data.get("results", [])
            return "\n\n".join([f"Source: {r.get('url')}\nContent: {r.get('raw_content', r.get('content'))}" for r in results])
    except Exception as e:
        print(f"[Tavily Scraping Error] {e}")
        return ""

async def scrape_with_exa(query: str) -> str:
    """Extract structure content using Exa API."""
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        return ""
        
    try:
        async with httpx.AsyncClient(headers={"x-api-key": api_key}, timeout=10.0) as client:
            response = await client.post(
                "https://api.exa.ai/search",
                json={
                    "query": query,
                    "numResults": 2,
                    "contents": {"text": {"maxCharacters": 4000}}
                }
            )
            data = response.json()
            results = data.get("results", [])
            return "\n\n".join([f"Source: {r.get('url')}\nContent: {r.get('text')}" for r in results])
    except Exception as e:
        print(f"[Exa Scraping Error] {e}")
        return ""

async def aggregate_scrape(competitor_name: str, url: str) -> str:
    """Runs Tavily and Exa concurrently and merges output for LLM context."""
    tavily_task = scrape_with_tavily(f"{competitor_name} product features pricing site:{url}")
    exa_task = scrape_with_exa(f"site:{url}")
    
    tavily_res, exa_res = await asyncio.gather(tavily_task, exa_task)
    
    combined = f"--- TAVILY RESULTS ---\n{tavily_res}\n\n--- EXA RESULTS ---\n{exa_res}"
    return combined

# ==========================================
# FEATURE VALIDATION PIPELINE
# ==========================================

def get_base_domain(url: str) -> str:
    """Extracts the base domain from a URL for comparison."""
    try:
        parsed = urlparse(url)
        # simplistic domain extraction
        parts = parsed.netloc.replace("www.", "").split(".")
        return ".".join(parts[-2:]) if len(parts) >= 2 else parsed.netloc
    except:
        return ""

async def verify_feature_sources(features: List[Dict[str, str]], base_url: str) -> List[Dict[str, str]]:
    """
    STEP 3 - Source Validation
    - Each feature has a valid source URL
    - Source URL is reachable
    - Source domain matches competitor domain
    """
    valid_features = []
    base_domain = get_base_domain(base_url)
    
    async def validate_source(feat):
        source = feat.get("source", "").strip()
        if not source:
            return None
            
        # Domain match
        source_domain = get_base_domain(source)
        if base_domain and source_domain != base_domain:
            return None  # Third-party unrelated source
            
        is_valid = await verify_url(source)
        if not is_valid:
            return None
            
        return feat

    tasks = [validate_source(f) for f in features]
    if tasks:
        results = await asyncio.gather(*tasks)
        valid_features = [r for r in results if r is not None]
        
    return valid_features


def clean_features(features: List[Dict[str, str]]) -> List[str]:
    """
    STEP 4 - Feature Consistency
    - Check duplicate features
    - Normalize feature names 
    - Remove vague features ("great experience")
    
    STEP 5 - Final Clean Output
    Returns list of strings.
    """
    vague_keywords = ["great", "best", "high quality", "experience", "beautiful", "amazing", "awesome", "unknown"]
    clean_list = []
    seen = set()
    
    for feat in features:
        name = feat.get("feature", "").strip()
        name_lower = name.lower()
        
        # Exclude too short or vague
        if len(name) < 5 or any(vk in name_lower.split() for vk in vague_keywords):
            continue
            
        # Deduplicate
        if name_lower not in seen:
            seen.add(name_lower)
            # Normalization (e.g., capitalize first letter)
            normalized_name = name[0].upper() + name[1:] if name else name
            clean_list.append(normalized_name)
            
    return clean_list

# ==========================================
# END-TO-END VALIDATION WRAPPER
# ==========================================

async def process_and_validate_features(extracted_features: List[Dict[str, str]], comp_url: str) -> List[str]:
    """Wraps steps 3, 4 and 5."""
    source_validated = await verify_feature_sources(extracted_features, comp_url)
    cleaned_strings = clean_features(source_validated)
    return cleaned_strings
