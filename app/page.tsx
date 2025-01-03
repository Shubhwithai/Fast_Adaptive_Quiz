import Image from "next/image";
import Link from "next/link";
import QuestionGenerator from "./components/QuestionGenerator";
import FlashcardApp from "./components/FlashcardApp";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl">
        <h1 className="text-3xl font-bold text-center mb-8">
          Question Generator
        </h1>
        {/* <QuestionGenerator /> */}
        <FlashcardApp />
      </div>
    </main>
  );
}
