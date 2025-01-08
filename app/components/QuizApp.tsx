"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Question, UserResponse } from "./quiz-types";

export default function QuizApp() {
  const [topic, setTopic] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [quizSummary, setQuizSummary] = useState<any>(null);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);

  const startQuiz = async () => {
    try {
      setIsLoading(true);
      setCurrentQuestionNumber(1);
      const response = await fetch("/api/py/generate-initial-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ topic }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.detail) {
        throw new Error(data.detail);
      }

      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setScore(0);
      setQuestionsAnswered(0);
      setQuizSummary(null);
    } catch (error) {
      console.error("Error starting quiz:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit = async (selectedOption: string) => {
    if (!currentQuestion || showExplanation) return;

    setSelectedAnswer(selectedOption);
    setShowExplanation(true);
    const isCorrect = selectedOption === currentQuestion.answer;

    if (isCorrect) {
      setScore(score + 1);
    }
    setQuestionsAnswered(questionsAnswered + 1);
  };

  const submitQuiz = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/py/submit-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setQuizSummary(result);
      setCurrentQuestion(null);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } catch (error) {
      console.error("Error submitting quiz:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNextQuestion = async () => {
    if (!currentQuestion || !selectedAnswer) return;

    try {
      setIsLoading(true);
      setCurrentQuestionNumber(prev => prev + 1);
      const userResponse: UserResponse = {
        user_answer: selectedAnswer,
        previous_question: currentQuestion.question,
        response_correct: selectedAnswer === currentQuestion.answer,
        topic,
      };

      const response = await fetch("/api/py/generate-next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userResponse),
      });

      if (response.status === 400) {
        // Quiz is completed, submit for results
        await submitQuiz();
        return;
      }

      const result = await response.json();
      setCurrentQuestion(result);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } catch (error) {
      console.error("Error getting next question:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAnswerText = (letter: string, options?: string[]) =>{
    if (!options) return "";
    const option = options.find(opt => opt.startsWith(letter));
    return option ? option.substring(3) : ""; // Remove "A. ", "B. ", etc.
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold">
          Welcome to the Fast Adaptive Quiz!
        </CardTitle>
        <p className="text-center text-muted-foreground mt-2">
          This quiz app uses AI to generate personalized questions based on your chosen topic and adapts to your performance.
        </p>
        <div className="flex gap-2 mt-6">
          <Input
            type="text"
            placeholder="Enter a topic to learn"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="flex-1"
            disabled={isLoading}
          />
          <Button onClick={startQuiz} disabled={isLoading || !topic}>
            {isLoading ? "Loading..." : "Start Quiz"}
          </Button>
        </div>
        {questionsAnswered > 0 && (
          <div className="text-sm text-muted-foreground">
            Score: {score}/{questionsAnswered} (
            {Math.round((score / questionsAnswered) * 100)}%)
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {currentQuestion && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">
                <span className="text-muted-foreground mr-2">
                  Question {currentQuestionNumber}/5:
                </span>
                {currentQuestion.question}
              </div>
            </div>

            <div className="space-y-2">
              {currentQuestion.options?.map((option, index) => (
                <Button
                  key={index}
                  variant={
                    showExplanation
                      ? option === currentQuestion.answer
                        ? "default"
                        : selectedAnswer === option
                        ? "destructive"
                        : "outline"
                      : selectedAnswer === option
                      ? "default"
                      : "outline"
                  }
                  className="w-full justify-start"
                  onClick={() => handleAnswerSubmit(option)}
                  disabled={showExplanation || isLoading}
                >
                  {option}
                </Button>
              ))}
            </div>

            {showExplanation && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="font-medium">Explanation:</p>
                  <p>{currentQuestion.explanation}</p>
                </div>
                <Button
                  onClick={getNextQuestion}
                  disabled={isLoading}
                  className="w-full"
                >
                  Next Question
                </Button>
              </div>
            )}
          </div>
        )}
        {quizSummary && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Quiz Summary</h2>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">Final Score: {quizSummary.score}</p>
              <p>Total Questions: {quizSummary.total_questions}</p>
              <p>Correct Answers: {quizSummary.correct_answers}</p>
              <p>Time Taken: {Math.round(quizSummary.elapsed_time)} seconds</p>
            </div>
            <div className="space-y-4">
              {quizSummary.details.map((detail: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <p className="font-medium">
                    <span className="text-muted-foreground">Question {index + 1}:</span>{" "}
                    {detail.question}
                  </p>
                  <p className="mt-2">
                    <span className="font-medium">Your Answer: </span>
                    <span 
                      className={
                        detail.correct_answer === detail.user_answer 
                          ? "text-green-600 font-medium" 
                          : "text-red-600"
                      }
                    >
                      {detail.user_answer.includes(". ") 
                        ? detail.user_answer 
                        : `${detail.user_answer}. ${getAnswerText(detail.user_answer, currentQuestion?.options)}`}
                    </span>
                  </p>
                  {detail.correct_answer !== detail.user_answer && (
                    <p className="mt-1">
                      <span className="font-medium">Correct Answer: </span>
                      <span className="text-green-600 font-medium">
                        {detail.correct_answer.includes(". ") 
                          ? detail.correct_answer 
                          : `${detail.correct_answer}. ${getAnswerText(detail.correct_answer, currentQuestion?.options)}`}
                      </span>
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Button
              onClick={startQuiz}
              className="w-full mt-4"
            >
              Try Another Quiz
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
