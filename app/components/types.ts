export interface Flashcard {
  front: string;
  back: string;
  explanation: string;
}

export interface FlashcardSet {
  title: string;
  flashcards: Flashcard[];
}
