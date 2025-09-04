import { openai } from './openai';
import { JournalEntry } from '@/types/journal';

export interface EntrySummary {
  highlights: string[];
  decisions: string[];
  actions: string[];
  risks: string[];
  mood: string;
}

export async function summariseEntry(entry: JournalEntry): Promise<EntrySummary> {
  const contentToAnalyse = [
    entry.content,
    entry.transcript ? `Audio transcript: "${entry.transcript}"` : ''
  ].filter(Boolean).join('\n\n');

  const prompt = `Analyze this journal entry and extract key insights. Focus on actionable intelligence and emotional patterns.

**Content to analyze:**
${contentToAnalyse}

**Context:**
- Tags: ${entry.tags.join(', ') || 'None'}
- Date: ${entry.timestamp.toDateString()}
- Entry type: ${entry.audioBlob ? 'Voice + Text' : 'Text only'}

Extract and return as valid JSON:
{
  "highlights": ["Key insight 1", "Key insight 2"], // 2-3 most important points
  "decisions": ["Decision made"], // Any choices or commitments
  "actions": ["Action item"], // Next steps or tasks mentioned
  "risks": ["Concern identified"], // Worries, obstacles, or red flags
  "mood": "descriptive word" // Overall emotional tone in 1-2 words
}

Guidelines:
- Keep items concise (under 50 chars each)
- Focus on patterns that could help with personal growth
- Identify both explicit and implicit themes
- Return only valid JSON, no commentary`;

  try {
    const response = await openai.chatCompletion([
      {
        role: 'system',
        content: 'You are a helpful assistant that analyzes journal entries. Always respond with valid JSON only, no additional text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]);

    const summary = JSON.parse(response.trim());
    
    // Validate the response structure
    return {
      highlights: Array.isArray(summary.highlights) ? summary.highlights : [],
      decisions: Array.isArray(summary.decisions) ? summary.decisions : [],
      actions: Array.isArray(summary.actions) ? summary.actions : [],
      risks: Array.isArray(summary.risks) ? summary.risks : [],
      mood: typeof summary.mood === 'string' ? summary.mood : 'neutral'
    };
  } catch (error) {
    console.error('Summarization failed:', error);
    throw new Error('Failed to summarize entry - check your API key and connection');
  }
}

export async function compileWeeklyDigest(entries: JournalEntry[]): Promise<string> {
  if (entries.length === 0) {
    return 'No entries found for the past week.';
  }

  // Prepare entries for analysis
  const entriesData = entries.map(entry => ({
    date: entry.timestamp.toDateString(),
    content: entry.content,
    tags: entry.tags,
    transcript: entry.transcript || null
  }));

  const prompt = `Analyze these journal entries from the past week and create a comprehensive digest.

**Entries to analyze:**
${JSON.stringify(entriesData, null, 2)}

Please create a markdown digest with the following sections:
1. **Weekly Overview** - Brief summary of the week
2. **Key Themes** - Main recurring topics or patterns
3. **Emotional Journey** - How mood/feelings evolved over the week  
4. **Achievements & Progress** - Positive developments and accomplishments
5. **Challenges & Concerns** - Issues that came up multiple times
6. **Action Items** - Things to focus on next week
7. **Insights** - Deeper patterns or realizations

Make it personal, insightful, and actionable. Use bullet points and keep sections concise.`;

  try {
    const response = await openai.chatCompletion([
      {
        role: 'system',
        content: 'You are a thoughtful life coach who helps people reflect on their journal entries. Write in a warm, supportive tone.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]);

    return response.trim();
  } catch (error) {
    console.error('Weekly digest generation failed:', error);
    throw new Error('Failed to generate weekly digest - check your API key and connection');
  }
}