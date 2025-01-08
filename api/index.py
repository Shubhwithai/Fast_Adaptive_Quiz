import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
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
The question should be clear, relevant, and aligned with the topic. 

Format your response exactly as follows:
1. Write the question
2. Provide four options formatted exactly as:
   A. [First option]
   B. [Second option]
   C. [Third option]
   D. [Fourth option]
3. Indicate the correct answer using just the letter (A, B, C, or D)
4. Provide a brief explanation for why the answer is correct

Topic: {topic}
Previous Question: {previous_question}
User's Response: {user_response}
Was the response correct?: {response_correct}

Guidelines:
1. Avoid repeating questions
2. Ensure the question is specific and tests knowledge effectively
3. Make all options plausible but only one correct
4. Include clear explanations
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

# Initialize global variables to track quiz state
quiz_data = {
    "questions": [],
    "correct_answers": [],
    "user_answers": [],
    "start_time": None,
    "question_count": 0,  # Track the number of questions asked
}

@app.post("/py/generate-initial-question")
def generate_initial_question(request: TopicRequest) -> Question:
    """Generate the first question for the quiz."""
    try:
        print(f"Received topic request: {request.topic}")
        result = educhain_client.qna_engine.generate_questions(
            topic=request.topic,
            num=1,
            learning_objective=f"General knowledge of {request.topic}",
            difficulty_level="Medium",
            prompt_template=INITIAL_QUESTION_TEMPLATE,
        )
        
        if result and result.questions:
            question_data = result.questions[0]
            response = Question(
                question=question_data.question,
                options=question_data.options,
                answer=question_data.answer,
                explanation=question_data.explanation,
            )

            # Reset quiz data for new quiz
            reset_quiz_data()
            
            # Initialize first question data
            quiz_data["start_time"] = time.time()
            quiz_data["question_count"] = 1
            # Don't store the first question yet - it will be stored after the user answers
            
            return response
        raise HTTPException(status_code=400, detail="No questions generated.")
    except Exception as e:
        print(f"Error generating question: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/py/generate-next-question")
def generate_next_question(user_response: UserResponse) -> Question:
    """Generate the next adaptive question based on user's performance."""
    MAX_QUESTIONS = 6

    try:
        # Store the previous question and user's answer
        quiz_data["questions"].append(user_response.previous_question)
        quiz_data["user_answers"].append(user_response.user_answer)
        
        # Get the next question
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
            quiz_data["question_count"] += 1

            # Store the correct answer with its full text
            answer_letter = question_data.answer
            answer_text = next(
                (opt for opt in question_data.options if opt.startswith(f"{answer_letter}. ")),
                question_data.answer
            )
            quiz_data["correct_answers"].append(answer_text)

            # Check if we've reached the maximum questions
            if quiz_data["question_count"] >= MAX_QUESTIONS:
                raise HTTPException(status_code=400, detail="Quiz completed. Please submit to view results.")

            # Format the options to include letter prefixes if they don't have them
            formatted_options = []
            for i, opt in enumerate(question_data.options):
                if not opt.startswith(('A. ', 'B. ', 'C. ', 'D. ')):
                    letter = chr(65 + i)  # 65 is ASCII for 'A'
                    formatted_options.append(f"{letter}. {opt}")
                else:
                    formatted_options.append(opt)

            return Question(
                question=question_data.question,
                options=formatted_options,
                answer=answer_letter,
                explanation=question_data.explanation,
            )
        raise HTTPException(status_code=400, detail="No questions generated.")
    except Exception as e:
        print(f"Error generating next question: {str(e)}")
        if "Quiz completed" in str(e):
            raise HTTPException(status_code=400, detail="Quiz completed. Please submit to view results.")
        raise HTTPException(status_code=500, detail=f"Error generating next question: {str(e)}")

@app.post("/py/submit-quiz")
def submit_quiz():
    """Submit the quiz and display results."""
    try:
        total_questions = len(quiz_data["questions"])
        
        # Get the answer letters from the full answer texts
        user_answer_letters = [ans.split('.')[0] if '.' in ans else ans 
                             for ans in quiz_data["user_answers"]]
        correct_answer_letters = [ans.split('.')[0] if '.' in ans else ans 
                                for ans in quiz_data["correct_answers"]]

        # Calculate correct answers
        correct_count = sum(
            1 for user_ans, correct_ans in zip(user_answer_letters, correct_answer_letters)
            if user_ans == correct_ans
        )

        elapsed_time = time.time() - quiz_data["start_time"]

        results = {
            "total_questions": total_questions,
            "correct_answers": correct_count,
            "score": f"{correct_count}/{total_questions}",
            "elapsed_time": elapsed_time,
            "details": [
                {
                    "question": quiz_data["questions"][i],
                    "correct_answer": quiz_data["correct_answers"][i],
                    "user_answer": quiz_data["user_answers"][i],
                }
                for i in range(total_questions)
            ],
        }

        # Reset quiz data for the next quiz
        reset_quiz_data()

        return results
    except Exception as e:
        print(f"Error submitting quiz: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def reset_quiz_data():
    """Reset the quiz data for a new quiz session."""
    quiz_data["questions"] = []
    quiz_data["correct_answers"] = []
    quiz_data["user_answers"] = []
    quiz_data["start_time"] = None
    quiz_data["question_count"] = 0  # Reset the question counter