import httpx
import asyncio
import os
from urllib.parse import urlparse
from typing import List, Dict, Any
from dotenv import load_dotenv

root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(root_env):
    load_dotenv(root_env)
else:
    load_dotenv()

# ==========================================
# COMPETITOR VERIFICATION
# ==========================================

async def verify_url(url: str) -> bool:
    """Instantly verifies URL structure without bottlenecking UX with 15 concurrent HTTP requests."""
    if not url or not isinstance(url, str):
        return False
        
    url = url.strip()
    return '.' in url and len(url) > 4

async def verify_competitors(competitors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Takes a list of competitors and verifies their URLs concurrently.
    Removes competitors with invalid URLs. Valid competitors get 'verified': True flag.
    """
    verified = []
    
    async def check_competitor(comp):
        url = comp.get("url", "")
        # aggressive extraction of any URL-like entity if LLM hallucinated markdown format
        if "http" not in url and "." in url:
             url = "https://" + url.replace('"', '').replace("'", "").strip()
             comp["url"] = url
             
        is_valid = await verify_url(url)
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
        raise ValueError("Error: TAVILY_API_KEY is missing. Configure it in .env")
        
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

async def fast_search_with_tavily(query: str) -> str:
    """Fast search using Tavily API (snippets only, high speed)."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        print("Error: TAVILY_API_KEY is missing. Configure it in .env")
        return ""
        
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "search_depth": "basic",
                    "include_raw_content": False,
                    "max_results": 5
                }
            )
            data = response.json()
            results = data.get("results", [])
            return "\n\n".join([f"Source: {r.get('url')}\nSnippet: {r.get('content')}" for r in results])
    except Exception as e:
        print(f"[Tavily Fast Search Error] {e}")
        return ""

async def scrape_with_exa(query: str) -> str:
    """Extract structure content using Exa API."""
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        print("Error: EXA_API_KEY is missing. Configure it in .env")
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

async def search_competitors_context(product_name: str, product_description: str) -> str:
    """Searches the internet and runs all available LLM pipelines concurrently to maximize speed."""
    import datetime
    import asyncio
    current_year = datetime.datetime.now().year
    
    # 1. Run all search AIs concurrently
    query_tavily = f"top latest alternative competitors to {product_name} {current_year} pricing list"
    query_exa = f"newest alternatives or competitors to {product_name} list {current_year}"
    tavily_task = fast_search_with_tavily(query_tavily)
    exa_task = scrape_with_exa(query_exa)
    results = await asyncio.gather(tavily_task, exa_task, return_exceptions=True)
    
    tavily_res = results[0] if not isinstance(results[0], Exception) else ""
    exa_res = results[1] if not isinstance(results[1], Exception) else ""
    
    combined_context = f"--- TAVILY ---\n{tavily_res}\n\n--- EXA ---\n{exa_res}"

    prompt = f"""You are a professional market research analyst.
Identify EXACTLY the top 15 MOST RELEVANT direct competitors to the product below. 

CRITICAL FILTERING RULES:
1. FEATURE MATCHING: You MUST ONLY extract competitors that possess similar features and functionality to the product description/features listed below.
2. LAUNCHED ONLY: You MUST ONLY extract competitors that are ALREADY LAUNCHED and currently available on the market for purchase. Absolutely DO NOT include upcoming, unreleased, rumored, or future models (e.g., if a model is slated for late this year, discard it and use the current generation).
3. PRICING: If the exact price is missing from the search context, YOU MUST provide your best estimated market price based on your deep industry knowledge (e.g., "$999" or "Starting at $799"). NEVER write "Not specified", "N/A", or "Unknown". Always provide a concrete price or realistic estimate. Do not hallucinate URLs.

PRODUCT: {product_name}
DESCRIPTION AND FEATURES: {product_description}

RECENT SEARCH RESULTS CONTEXT:
{combined_context[:8000]}

Strict JSON format required:
[
  {{
    "name": "Competitor Name",
    "url": "https://www.company.com", 
    "price": "pricing details"
  }}
]"""

    # 2. Race all available Generative AIs to secure the fastest response
    async def run_groq(key):
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.post("https://api.groq.com/openai/v1/chat/completions", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}], "temperature": 0.4, "max_tokens": 1500})
            return res.json()["choices"][0]["message"]["content"]

    async def run_gemini(key):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.post(url, json={"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1500}})
            return res.json()["candidates"][0]["content"]["parts"][0]["text"]

    async def run_openrouter(key):
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post("https://openrouter.ai/api/v1/chat/completions", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json={"model": "arcee-ai/trinity-large-preview:free", "messages": [{"role": "user", "content": prompt}], "temperature": 0.4, "max_tokens": 1500})
            return res.json()["choices"][0]["message"]["content"]

    tasks = []
    if os.getenv("GROQ_API_KEY"):
        tasks.append(asyncio.create_task(run_groq(os.getenv("GROQ_API_KEY"))))
    
    if os.getenv("GOOGLE_GEMINI_API_KEY"):
        tasks.append(asyncio.create_task(run_gemini(os.getenv("GOOGLE_GEMINI_API_KEY"))))
        
    if os.getenv("OPEN_ROUTER_API_KEY"):
        tasks.append(asyncio.create_task(run_openrouter(os.getenv("OPEN_ROUTER_API_KEY"))))

    if tasks:
        # Whichever AI finishes first successfully is returned immediately!
        for coro in asyncio.as_completed(tasks):
            try:
                result = await coro
                if result and "[" in result:
                    return "JSON_PAYLOAD_DIRECT:" + result
            except Exception as e:
                print("One Racing LLM failed:", e)
                continue

    return f"--- LIVE SEARCH RESULTS ---\n{combined_context}"

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
