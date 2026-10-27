export const reactionEmojis = ['❤️', '😂', '👍', '😊', '🔥'] as const;
export type MessageReaction = {
  message_id: string;
  emoji: string;
  count: number;
  mine: number;
};
export function conversationStarters(lastMessage = '') {
  if (/music|song|jazz|concert|playlist/i.test(lastMessage))
    return [
      'What are you listening to lately?',
      'Who would you love to see live?',
    ];
  if (/coffee|food|cook|restaurant/i.test(lastMessage))
    return [
      'What’s your favorite spot for coffee?',
      'What’s a meal you love making?',
    ];
  return [
    'What’s been the highlight of your week?',
    'How do you like spending a free afternoon?',
  ];
}
