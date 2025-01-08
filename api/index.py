import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Set
import time
from educhain import Educhain, LLMConfig
from langchain_openai import ChatOpenAI

load_dotenv()

app = FastAPI()
# Templates
INITIAL_QUESTION_TEMPLATE: str = """
Generate a unique and high-quality multiple-choice question (MCQ) based on the given topic and level.
The question should be clear, relevant, and aligned with the topic. Provide four answer options and the correct answer.
Topic: {topic}
Learning Objective: {learning_objective}
Difficulty Level: {difficulty_level}
Guidelines:
1. Avoid repeating questions.
2. Ensure the question is specific and tests knowledge effectively.
3. Provide plausible distractors (incorrect options).
4. Include a brief explanation for the correct answer.
"""
ADAPTIVE_QUESTION_TEMPLATE: str = """
Based on the user's response to the previous question on {topic}, generate a new unique and high-quality multiple-choice question (MCQ).
If the user's response is correct, output a harder question. Otherwise, output an easier question.
The question should be clear, relevant, and aligned with the topic. Provide four answer options and the correct answer.
Previous Question: {previous_question}
User's Response: {user_response}
Was the response correct?: {response_correct}
Guidelines:
1. Avoid repeating questions.
2. Ensure the question is specific and tests knowledge effectively.
3. Provide plausible distractors (incorrect options).
4. Include a brief explanation for the correct answer.
"""
# Models
class Question(BaseModel):
    question: str
    options: List[str]
    answer: str
    explanation: Optional[str] = None
class UserResponse(BaseModel):
    user_answer: str
    previous_question: str
    response_correct: bool
    topic: str
# Add this class to define the request body structure
class TopicRequest(BaseModel):
    topic: str
# Initialize LLM Client
def get_llm(api_key: str) -> ChatOpenAI:
    """Initialize and cache the LLM client."""
    return ChatOpenAI(
        model="llama-3.1-70b-versatile",
        openai_api_base="https://api.groq.com/openai/v1",
        openai_api_key=api_key
    )
@app.on_event("startup")
def startup_event():
    global educhain_client
    api_key = os.getenv("GROQ_API_KEY")  # Load from environment variable
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set")
    llm = get_llm(api_key)
    educhain_client = Educhain(LLMConfig(custom_model=llm))
@app.post("/py/generate-initial-question")
def generate_initial_question(request: TopicRequest) -> Question:
    """Generate the first question for the quiz."""
    try:
        print(f"Received topic request: {request.topic}")  # Debug log
        result = educhain_client.qna_engine.generate_questions(
            topic=request.topic,
            num=1,
            learning_objective=f"General knowledge of {request.topic}",
            difficulty_level="Medium",
            prompt_template=INITIAL_QUESTION_TEMPLATE,
        )
        print(f"Generated result: {result}")  # Debug log
        if result and result.questions:
            question_data = result.questions[0]
            response = Question(
                question=question_data.question,
                options=question_data.options,
                answer=question_data.answer,
                explanation=question_data.explanation,
            )
            print(f"Returning response: {response}")  # Debug log
            return response
        raise HTTPException(status_code=400, detail="No questions generated.")
    except Exception as e:
        print(f"Error generating question: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/py/generate-next-question")
def generate_next_question(user_response: UserResponse) -> Question:
    """Generate the next adaptive question based on user's performance."""
    try:
        result = educhain_client.qna_engine.generate_questions(
            topic=user_response.topic,
            num=1,
            learning_objective=f"General knowledge of {user_response.topic}",
            difficulty_level="Harder" if user_response.response_correct else "Easier",
            prompt_template=ADAPTIVE_QUESTION_TEMPLATE,
            previous_question=user_response.previous_question,
            user_response=user_response.user_answer,
            response_correct=str(user_response.response_correct),
        )
        if result and result.questions:
            question_data = result.questions[0]
            return Question(
                question=question_data.question,
                options=question_data.options,
                answer=question_data.answer,
                explanation=question_data.explanation,
            )
        raise HTTPException(status_code=400, detail="No questions generated.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))