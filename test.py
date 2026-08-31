from openai import OpenAI

client = OpenAI(
    base_url="https://agentrouter.org/v1",
    api_key="sk-Fglgq1YP5aC2pPS0jv6Krb1xujbP6AIpDnYslBpZK9vY7jVr"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5-20250929",
    messages=[{"role": "user", "content": "Hello Agent Router!"}]
)

print(response.choices[0].message.content)
