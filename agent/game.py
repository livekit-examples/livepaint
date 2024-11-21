from typing import Literal, List
import json
from collections import OrderedDict

DifficultyLevel = Literal["easy", "medium", "hard"]

PROMPTS = {
    "easy": [
        "cat",
        "dog",
        "elephant",
        "giraffe",
        "lion",
        "monkey",
        "penguin",
        "rabbit",
        "turtle",
        "bed",
        "door",
        "fan",
        "apple",
        "banana",
        "cake",
        "cookie",
        "car",
        "boat",
        "bus",
    ],
    "medium": [
        "airplane",
        "helicopter",
        "rocket",
        "castle",
        "bridge",
        "lighthouse",
        "windmill",
        "doctor",
        "chef",
        "pilot",
        "dancer",
        "baseball",
        "basketball",
        "soccer",
        "tennis",
        "robot",
        "dragon",
        "wizard",
        "pirate",
        "ghost",
    ],
    "hard": [
        "thunderstorm",
        "northern lights",
        "coral reef",
        "redwood forest",
        "hot air balloon",
        "vacuum cleaner",
        "musical conductor",
        "construction site",
        "garden party",
        "tug of war",
        "arm wrestling",
        "rock climbing",
        "thumb wrestling",
        "playing chess",
        "building sandcastle",
    ],
}

NO_GUESS = "NO_GUESS"
CHEATER_CHEATER = "CHEATER_CHEATER"
PARTICIPANT_LIMIT = 12


class GameState:
    def __init__(
        self,
        started: bool = False,
        difficulty: DifficultyLevel = "easy",
        prompt: str | None = None,
        winners: List[str] = [],
    ):
        self.started = started
        self.difficulty = difficulty
        self.prompt = prompt
        self.winners = winners

    def to_json_string(self) -> str:
        return json.dumps(self.__dict__)

    @staticmethod
    def from_json_string(json_string: str) -> "GameState":
        return GameState(**json.loads(json_string))


class GuessCache:
    def __init__(self, max_size: int = 1000):
        self._cache = OrderedDict()
        self._max_size = max_size

    def get(self, hash: str) -> str | None:
        if hash in self._cache:
            self._cache.move_to_end(hash)
            return self._cache[hash]
        return None

    def set(self, hash: str, guess: str):
        if hash in self._cache:
            self._cache.move_to_end(hash)
        else:
            if len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)
        self._cache[hash] = guess
