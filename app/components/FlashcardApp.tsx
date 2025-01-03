"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BookOpen, MessageSquare } from "lucide-react";
import { useState } from "react";
import { FlashcardSet } from "./types";

export default function FlashcardApp() {
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const generateFlashcards = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/py/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, num_flashcards: numQuestions }),
      });
      const data: FlashcardSet[] = JSON.parse(await response.json());

      const newSet = Array.isArray(data) ? data[0] : data;
      setFlashcardSets([...flashcardSets, newSet]);
      setCurrentSetIndex(flashcardSets.length);
      setCurrentCardIndex(0);
      setShowAnswer(false);
      setProgress(0);
    } catch (error) {
      console.error("Error generating flashcards:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentSet = flashcardSets[currentSetIndex];
  const currentCard = currentSet?.flashcards?.[currentCardIndex];

  const nextCard = () => {
    if (!currentSet) return;
    if (currentCardIndex < currentSet.flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      setCurrentCardIndex(0);
      setCurrentSetIndex((currentSetIndex + 1) % flashcardSets.length);
    }
    setShowAnswer(false);
    setProgress(((currentCardIndex + 1) / currentSet.flashcards.length) * 100);
  };

  const prevCard = () => {
    if (!currentSet) return;
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    } else {
      const prevSetIndex =
        (currentSetIndex - 1 + flashcardSets.length) % flashcardSets.length;
      setCurrentSetIndex(prevSetIndex);
      setCurrentCardIndex(flashcardSets[prevSetIndex].flashcards.length - 1);
    }
    setShowAnswer(false);
    setProgress((currentCardIndex / currentSet.flashcards.length) * 100);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="space-y-6">
        <CardTitle>Learning Flash Cards</CardTitle>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter a topic to learn"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="flex-1"
            disabled={isLoading}
          />
          <Input
            type="number"
            min={1}
            max={20}
            value={numQuestions}
            onChange={(e) => setNumQuestions(Number(e.target.value))}
            className="w-24"
            disabled={isLoading}
          />
          <Button onClick={generateFlashcards} disabled={isLoading}>
            {isLoading ? "Generating..." : "Generate Cards"}
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Set Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {flashcardSets.length > 0 && (
          <div className="grid grid-cols-5 gap-4">
            {flashcardSets.map((set, index) => (
              <Button
                key={index}
                variant={currentSetIndex === index ? "default" : "outline"}
                onClick={() => {
                  setCurrentSetIndex(index);
                  setCurrentCardIndex(0);
                  setShowAnswer(false);
                  setProgress(0);
                }}
                className="h-auto py-2 px-3 w-fit"
              >
                <div className="text-center">
                  <div className="text-xs">Set {index + 1}</div>
                  <div className="text-sm break-words w-full">{set.title}</div>
                </div>
              </Button>
            ))}
          </div>
        )}

        {currentCard && (
          <div className="space-y-6 py-8">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">{currentSet.title}</h3>
            </div>

            <div className="min-h-[200px] flex items-center justify-center border rounded-lg p-6">
              <p className="text-center">
                {showAnswer ? currentCard.back : currentCard.front}
              </p>
            </div>

            {showAnswer && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Explanation:</h4>
                <p>{currentCard.explanation}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={prevCard}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Card {currentCardIndex + 1}/{currentSet.flashcards.length}
              </span>
              <Button onClick={nextCard}>Next</Button>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowAnswer(!showAnswer)}
              >
                <BookOpen className="w-4 h-4" />
                {showAnswer ? "Hide Answer" : "Show Answer"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Discussion
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
