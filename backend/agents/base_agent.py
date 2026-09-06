import json
import re

from backend.llm.bedrock_client import BedrockClient


class BaseAgent:

    def __init__(self, name: str):
        self.name = name

        self.llm = BedrockClient(
            model_id="anthropic.claude-3-haiku-20240307-v1:0"
        )

    def analyse(self, scenario: dict) -> dict:
        raise NotImplementedError

    def run_json_prompt(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback_factory=None,
    ) -> dict:

        try:
            response = self.llm.ask(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.0,
            )

            cleaned = self._clean_json(response)

            result = json.loads(cleaned)

            return self._normalise_result(result)

        except Exception as error:

            print(
                f"{self.name} LLM unavailable: {error}"
            )

            if fallback_factory is not None:
                print(
                    f"{self.name}: using deterministic fallback."
                )

                return fallback_factory()

            return {
                "agent": self.name,
                "status": "failed",
                "severity": "low",
                "summary": f"{self.name} failed.",
                "findings": [],
                "constraints": [],
                "recommended_actions": [],
            }

    def _clean_json(self, text: str) -> str:

        text = text.strip()

        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        )

        text = re.sub(
            r"\s*```$",
            "",
            text,
        )

        start = text.find("{")
        end = text.rfind("}")

        if start != -1 and end != -1:
            text = text[start:end + 1]

        return text.strip()

    def _normalise_result(
        self,
        result: dict,
    ) -> dict:

        return {
            "agent": self.name,
            "status": result.get(
                "status",
                "completed",
            ),
            "severity": result.get(
                "severity",
                "low",
            ),
            "summary": result.get(
                "summary",
                "",
            ),
            "findings": result.get(
                "findings",
                [],
            ),
            "constraints": result.get(
                "constraints",
                [],
            ),
            "recommended_actions": result.get(
                "recommended_actions",
                [],
            ),
        }