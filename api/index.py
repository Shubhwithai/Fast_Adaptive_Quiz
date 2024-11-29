from fastapi import FastAPI, Body
from educhain import Educhain
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}

@app.post("/api/py/generate-questions")
def generate_questions(topic: str = Body(...), num_questions: Optional[int] = Body(default=5)):
    client = Educhain()
    questions = client.qna_engine.generate_questions(
        topic=topic,
        num=num_questions
    )
    return questions.json()