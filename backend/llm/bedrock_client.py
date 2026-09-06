import os
import time

import boto3

from botocore.config import Config
from botocore.exceptions import ClientError


class BedrockClient:

    def __init__(
        self,
        model_id=None,
    ):

        self.model_id = (
            model_id
            or os.getenv(
                "IRIS_MODEL_ID",
                "anthropic.claude-3-5-sonnet-20240620-v1:0",
            )
        )

        self.region = os.getenv(
            "IRIS_AWS_REGION",
            "ap-southeast-1",
        )

        self.profile = os.getenv(
            "IRIS_AWS_PROFILE",
            "iris-hackathon",
        )

        session = boto3.Session(
            profile_name=self.profile
        )

        # IMPORTANT:
        # boto3/botocore normally retries automatically.
        # We reduce this so it does not multiply our own retries.
        config = Config(
            retries={
                "max_attempts": 1,
                "mode": "standard",
            },
            connect_timeout=10,
            read_timeout=90,
        )

        self.client = session.client(
            "bedrock-runtime",
            region_name=self.region,
            config=config,
        )

    def ask(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1500,
        temperature: float = 0.0,
        max_retries: int = 2,
    ) -> str:

        for attempt in range(max_retries):

            try:

                response = self.client.converse(
                    modelId=self.model_id,

                    system=[
                        {
                            "text": system_prompt
                        }
                    ],

                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "text": user_prompt
                                }
                            ],
                        }
                    ],

                    inferenceConfig={
                        "maxTokens": max_tokens,
                        "temperature": temperature,
                    },
                )

                return (
                    response[
                        "output"
                    ][
                        "message"
                    ][
                        "content"
                    ][0][
                        "text"
                    ]
                )

            except ClientError as error:

                error_code = (
                    error.response
                    .get("Error", {})
                    .get("Code", "")
                )

                if error_code != "ThrottlingException":
                    raise

                if attempt == max_retries - 1:
                    raise

                print(
                    "Bedrock throttled. "
                    "Waiting 5 seconds before one retry..."
                )

                time.sleep(5)