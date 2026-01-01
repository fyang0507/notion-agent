export const RECOMMENDATION_CONFIG = {
  defaultCriteria: `User's general interest with scores from 1 (min) to 5 (max). Your curation should bias towards those with higher scores.

- AI/ML (5/5): the user loves to learn about the latest research while having an interest in seeing intriguing content explaining the fundamentals.
- History (3/5): your employer is keen on understanding the past to better inform our future decisions. He prefers macroscopic views with a specific object to study (e.g. The post-WII Germen reconstruction, the economic reformation of China since 1978, etc.)
- Politics / Social Science (3/5): your employer loves to understand the social dynamics of different societies and how they are shaped by their theirtory and culture.
- Entrepreneurship / Entrepreneur interview (4/5): your employer loves hearing first-hand stories from emerging entrepreneurs and their unique perspectives, especially across the topics that matches their interests.
- Investing / Finance (4/5): your employer would like to grasp the market dynamics and the macroeconomic trends. His ultimate interest is to grow their wealth over the long-term. He is not from finance background and doesn't like technical investing.
- Music (2/5): your employer dreams of becoming a composer and is very interested in hearing expert talking about music theory and breaking down a song and analyze the underlying musical elements.
- Cuisine (2/5): your employer is interested in learning cooking "home-style dishes" that he can prepare for their family.
- Crypto (2/5): He is interested in understanding the fundamentals of crypto and how crypto can be leveraged to increase long-term personal wealth.
- Weird, unusual stories and science (1/5): your employer is interested in learning about unusual stories and scientific discoveries, especially those that looks mundane on the surface but have profound implications.

Themes your employer is not interested in and you should avoid:
- Biology / Healthcare / Drug discovery
- Entertainment / Movies / TV shows
- Travel logs
- Promotional content`,
  maxEpisodesPerFeed: 10,
  feedTimeoutMs: 10000,
  maxDescriptionLength: 5000,
};
