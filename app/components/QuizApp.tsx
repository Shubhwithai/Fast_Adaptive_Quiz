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

  const startQuiz = async () => {
    try {
      setIsLoading(true);
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

  const getNextQuestion = async () => {
    if (!currentQuestion || !selectedAnswer) return;

    try {
      setIsLoading(true);
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

      const question: Question = await response.json();

      setCurrentQuestion(question);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } catch (error) {
      console.error("Error getting next question:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Adaptive Quiz</CardTitle>
        <div className="flex gap-2">
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
            <div className="text-lg font-medium">
              {currentQuestion.question}
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
      </CardContent>
    </Card>
  );
}
