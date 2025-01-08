export interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface UserResponse {
  user_answer: string;
  previous_question: string;
  response_correct: boolean;
  topic: string;
}
