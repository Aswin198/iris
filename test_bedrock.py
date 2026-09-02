import boto3

REGION = "ap-southeast-1"
PROFILE = "iris-hackathon"
MODEL_ID = "anthropic.claude-3-5-sonnet-20240620-v1:0"

session = boto3.Session(profile_name=PROFILE)

client = session.client(
    "bedrock-runtime",
    region_name=REGION
)

response = client.converse(
    modelId=MODEL_ID,
    system=[
        {
            "text": "You are IRIS, an AI system for airport disruption recovery."
        }
    ],
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "text": "Reply with exactly: Hello from IRIS"
                }
            ]
        }
    ],
    inferenceConfig={
        "maxTokens": 50,
        "temperature": 0
    }
)

print(response["output"]["message"]["content"][0]["text"])
