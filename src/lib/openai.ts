interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class OpenAIAPI {
  private getApiKey(): string {
    const apiKey = localStorage.getItem('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please add your API key in Settings.');
    }
    return apiKey;
  }

  async chatCompletion(messages: ChatMessage[], model: string = 'gpt-4o-mini'): Promise<string> {
    const apiKey = this.getApiKey();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data: ChatCompletionResponse = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }
}

export const openai = new OpenAIAPI();