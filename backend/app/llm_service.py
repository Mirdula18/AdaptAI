"""
LLM Service — Handles communication with local LLM (Ollama / llama.cpp).
All AI generation goes through this module.
"""
import json
import re
import requests
from flask import current_app


class LLMService:
    """Wrapper around local LLM inference."""

    @staticmethod
    def _call_ollama(prompt: str, temperature: float = 0.7, max_tokens: int = 2048) -> str:
        """Call the Ollama API."""
        base_url = current_app.config["LLM_BASE_URL"]
        model = current_app.config["LLM_MODEL"]

        try:
            resp = requests.post(
                f"{base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
                timeout=120,
            )
            resp.raise_for_status()
            return resp.json().get("response", "")
        except requests.exceptions.ConnectionError:
            raise LLMConnectionError("Cannot connect to LLM service. Ensure Ollama is running.")
        except requests.exceptions.Timeout:
            raise LLMConnectionError("LLM request timed out.")
        except Exception as e:
            raise LLMConnectionError(f"LLM error: {str(e)}")

    @classmethod
    def generate_quiz(cls, topic: str, num_questions: int = 5, difficulty: str = "medium",
                      context: str = None) -> list:
        """Generate MCQ questions using the local LLM."""
        context_block = ""
        if context:
            context_block = f"\n\nUse the following course material as reference:\n{context[:3000]}\n"

        prompt = f"""You are an expert quiz generator for an educational platform.

Generate exactly {num_questions} multiple-choice questions about: {topic}
Difficulty level: {difficulty}
{context_block}

IMPORTANT: Respond ONLY with a valid JSON array. No explanations before or after.

Each object in the array must have exactly these fields:
- "question": the question text
- "option_a": option A text
- "option_b": option B text
- "option_c": option C text
- "option_d": option D text
- "correct_answer": one letter "A", "B", "C", or "D"
- "explanation": brief explanation of the correct answer

Example format:
[
  {{
    "question": "What is X?",
    "option_a": "Answer A",
    "option_b": "Answer B",
    "option_c": "Answer C",
    "option_d": "Answer D",
    "correct_answer": "A",
    "explanation": "A is correct because..."
  }}
]

Generate exactly {num_questions} questions now:"""

        raw = cls._call_ollama(prompt, temperature=0.7, max_tokens=3000)
        return cls._parse_quiz_response(raw, num_questions)

    @classmethod
    def generate_roadmap(cls, course_title: str, score_percent: float,
                         weak_topics: list, duration_weeks: int = 6) -> list:
        """Generate a personalized learning roadmap using the local LLM."""
        weak_str = ", ".join(weak_topics) if weak_topics else "general concepts"

        prompt = f"""You are an expert learning advisor for an educational platform.

Create a {duration_weeks}-week personalized learning plan for a student who scored {score_percent}% on a quiz about "{course_title}".

The student is weak in these areas: {weak_str}

IMPORTANT: Respond ONLY with a valid JSON array. No explanations before or after.

Each object in the array must have exactly these fields:
- "week": week number (integer)
- "focus": main focus area for this week
- "topics": array of specific topics to cover
- "resources": array of suggested resource types (e.g., "video tutorial", "practice problems", "reading material")
- "goals": what the student should achieve by end of this week
- "hours": estimated study hours for this week (integer)

Example format:
[
  {{
    "week": 1,
    "focus": "Foundation Review",
    "topics": ["Basic Concepts", "Terminology"],
    "resources": ["video tutorials", "reading material"],
    "goals": "Understand core terminology and basic principles",
    "hours": 8
  }}
]

Generate the complete {duration_weeks}-week plan now:"""

        raw = cls._call_ollama(prompt, temperature=0.7, max_tokens=3000)
        return cls._parse_roadmap_response(raw, duration_weeks)

    @staticmethod
    def _parse_quiz_response(raw: str, expected_count: int) -> list:
        """Parse LLM response into structured quiz questions."""
        # Try to extract JSON array from response
        json_match = re.search(r'\[.*\]', raw, re.DOTALL)
        if json_match:
            try:
                questions = json.loads(json_match.group())
                if isinstance(questions, list):
                    validated = []
                    for q in questions[:expected_count]:
                        if all(k in q for k in ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer"]):
                            q["correct_answer"] = q["correct_answer"].upper().strip()
                            if q["correct_answer"] in ["A", "B", "C", "D"]:
                                validated.append(q)
                    if validated:
                        return validated
            except json.JSONDecodeError:
                pass

        raise LLMParseError("Failed to parse quiz response from LLM. Please try again.")

    @staticmethod
    def _parse_roadmap_response(raw: str, expected_weeks: int) -> list:
        """Parse LLM response into structured roadmap plan."""
        json_match = re.search(r'\[.*\]', raw, re.DOTALL)
        if json_match:
            try:
                plan = json.loads(json_match.group())
                if isinstance(plan, list):
                    validated = []
                    for week in plan[:expected_weeks]:
                        if "week" in week and "focus" in week:
                            validated.append({
                                "week": week.get("week"),
                                "focus": week.get("focus", ""),
                                "topics": week.get("topics", []),
                                "resources": week.get("resources", []),
                                "goals": week.get("goals", ""),
                                "hours": week.get("hours", 5),
                            })
                    if validated:
                        return validated
            except json.JSONDecodeError:
                pass

        raise LLMParseError("Failed to parse roadmap response from LLM. Please try again.")

    @classmethod
    def health_check(cls) -> dict:
        """Check if the LLM service is available."""
        try:
            base_url = current_app.config["LLM_BASE_URL"]
            resp = requests.get(f"{base_url}/api/tags", timeout=5)
            resp.raise_for_status()
            models = resp.json().get("models", [])
            model_names = [m.get("name", "") for m in models]
            return {"status": "online", "models": model_names}
        except Exception:
            return {"status": "offline", "models": []}


class LLMConnectionError(Exception):
    pass


class LLMParseError(Exception):
    pass
